import 'server-only'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { cache } from 'react'
import type {
  ContentGene,
  ContentManifest,
  IsoformIndex,
  IsoformIndexEntry,
} from './types'

// Static gene/isoform content lives in public/data, written at build time by
// scripts/emit-content.ts. These readers read directly from the filesystem on
// the server so the data is bundled into prerendered pages but never sent to
// the client (no module-level imports).

const CONTENT_DIR = join(process.cwd(), 'public', 'data')

export const readManifest = cache(async (): Promise<ContentManifest> => {
  const raw = await readFile(join(CONTENT_DIR, 'manifest.json'), 'utf8')
  return JSON.parse(raw) as ContentManifest
})

export const readIsoformIndex = cache(async (): Promise<IsoformIndex> => {
  const raw = await readFile(join(CONTENT_DIR, 'isoform-index.json'), 'utf8')
  return JSON.parse(raw) as IsoformIndex
})

const readGeneFile = cache(
  async (symbol: string): Promise<ContentGene[] | null> => {
    const path = join(CONTENT_DIR, 'genes', `${symbol}.json`)
    if (!existsSync(path)) return null
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as ContentGene[]
  },
)

/**
 * Look up a gene by symbol (and optional species). When multiple species share
 * a symbol and species is unspecified, the first entry wins — matching the old
 * Postgres behavior where `LIMIT 1` without an order returned one arbitrarily.
 */
export async function readGeneBySymbol(
  symbol: string,
  species?: string | undefined,
): Promise<ContentGene | null> {
  const entries = await readGeneFile(symbol)
  if (!entries || entries.length === 0) return null
  if (species && species !== 'both') {
    return entries.find((e) => e.species === species) ?? null
  }
  return entries[0]
}

export interface IsoformAndGene {
  isoform: {
    id: string
    species: string
    geneId: string
    codingSequence: string
  }
  gene: { id: string; name: string; symbol: string }
}

export async function readIsoformAndGene(
  isoformId: string,
): Promise<IsoformAndGene | null> {
  const idx = await readIsoformIndex()
  const ref: IsoformIndexEntry | undefined = idx[isoformId]
  if (!ref) return null
  const gene = await readGeneBySymbol(ref.symbol, ref.species)
  if (!gene) return null
  const iso = gene.isoforms.find((i) => i.id === isoformId)
  if (!iso) return null
  return {
    isoform: {
      id: iso.id,
      species: iso.species,
      geneId: iso.geneId,
      codingSequence: iso.codingSequence,
    },
    gene: { id: gene.id, name: gene.name, symbol: gene.symbol },
  }
}

/**
 * Fuzzy-ish symbol suggestions for the not-found page. Reads the manifest
 * (small) and ranks by prefix > substring > short prefix, mirroring the old
 * `fetchSimilarGenes` ladder.
 */
export async function findSimilarSymbols(
  upperSymbol: string,
): Promise<{ symbol: string; species: string }[]> {
  if (!upperSymbol) return []
  const manifest = await readManifest()
  const prefix = upperSymbol
  const shortPrefix = upperSymbol.slice(0, 3)
  type Scored = { symbol: string; species: string; score: number }
  const seen = new Set<string>()
  const scored: Scored[] = []
  for (const entry of manifest.genes) {
    const upper = entry.symbol.toUpperCase()
    let score: number
    if (upper.startsWith(prefix)) score = 0
    else if (upper.includes(prefix)) score = 1
    else if (upperSymbol.length >= 3 && upper.startsWith(shortPrefix)) score = 2
    else continue
    const key = `${entry.symbol}::${entry.species}`
    if (seen.has(key)) continue
    seen.add(key)
    scored.push({ ...entry, score })
  }
  scored.sort((a, b) => a.score - b.score || a.symbol.localeCompare(b.symbol))
  return scored.slice(0, 5).map(({ score: _drop, ...rest }) => rest)
}

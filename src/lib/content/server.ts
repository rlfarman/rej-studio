import 'server-only'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { cache } from 'react'
import type {
  ContentGene,
  ContentIsoform,
  ContentManifest,
  IsoformIndex,
  IsoformIndexEntry,
} from './types'

// Static gene/isoform content lives in public/data, written by
// scripts/emit-content.ts. Server reads come straight from the filesystem,
// so prerendered pages bake in only the precomputed numbers — sequences
// stay in their own buckets and are lazy-loaded by the client on demand.

const CONTENT_DIR = join(process.cwd(), 'public', 'data')

function bucketOf(symbol: string): string {
  const c = symbol[0]?.toUpperCase() ?? '_'
  return /^[A-Z]$/.test(c) ? c : '_'
}

function proteinLenFromCds(cdsLen: number): number {
  return Math.max(0, Math.floor(cdsLen / 3) - 1)
}

export const readManifest = cache(async (): Promise<ContentManifest> => {
  const raw = await readFile(join(CONTENT_DIR, 'manifest.json'), 'utf8')
  return JSON.parse(raw) as ContentManifest
})

export const readIsoformIndex = cache(async (): Promise<IsoformIndex> => {
  const raw = await readFile(join(CONTENT_DIR, 'isoform-index.json'), 'utf8')
  return JSON.parse(raw) as IsoformIndex
})

type RawIsoform = Omit<ContentIsoform, 'proteinSequenceLength'>
type RawGene = Omit<ContentGene, 'isoforms'> & { isoforms: RawIsoform[] }

const readMetaBucket = cache(
  async (bucket: string): Promise<Record<string, ContentGene[]>> => {
    const path = join(CONTENT_DIR, 'genes-meta', `${bucket}.json`)
    if (!existsSync(path)) return {}
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, RawGene[]>
    const out: Record<string, ContentGene[]> = {}
    for (const [symbol, entries] of Object.entries(parsed)) {
      out[symbol] = entries.map((g) => ({
        ...g,
        isoforms: g.isoforms.map((i) => ({
          ...i,
          proteinSequenceLength: proteinLenFromCds(i.codingSequenceLength),
        })),
      }))
    }
    return out
  },
)

const readSeqBucket = cache(
  async (bucket: string): Promise<Record<string, string>> => {
    const path = join(CONTENT_DIR, 'sequences', `${bucket}.json`)
    if (!existsSync(path)) return {}
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as Record<string, string>
  },
)

/**
 * Look up a gene by symbol (and optional species). When multiple species share
 * a symbol and species is unspecified, the first entry wins.
 */
export async function readGeneBySymbol(
  symbol: string,
  species?: string | undefined,
): Promise<ContentGene | null> {
  const bucket = await readMetaBucket(bucketOf(symbol))
  const entries = bucket[symbol]
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
  const cds = (await readSeqBucket(ref.bucket))[isoformId] ?? ''
  return {
    isoform: {
      id: iso.id,
      species: iso.species,
      geneId: iso.geneId,
      codingSequence: cds,
    },
    gene: { id: gene.id, name: gene.name, symbol: gene.symbol },
  }
}

/**
 * Fuzzy-ish symbol suggestions for the not-found page. Reads the manifest
 * and ranks by prefix > substring > short prefix.
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

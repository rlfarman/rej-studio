/**
 * Emit static gene/isoform content from Postgres to public/data/.
 *
 * Reads the gene + isoform tables once and writes:
 *   public/data/manifest.json          — { genes: [{symbol, species}] }
 *   public/data/isoform-index.json     — { [isoformId]: {symbol, species} }
 *   public/data/search-index.json      — MiniSearch.toJSON() over symbols/names/aliases
 *   public/data/genes/<symbol>.json    — full gene + isoforms payload (one file per symbol)
 *
 * Idempotent: clears public/data/genes/ and rewrites everything. Safe to re-run.
 *
 * Skipped automatically when DATABASE_URL is missing AND artifacts already exist
 * (so CI builds work without a live DB once the artifacts are cached).
 *
 * Usage:
 *   pnpm content:emit
 *   tsx --env-file=.env scripts/emit-content.ts
 */

import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import MiniSearch from 'minisearch'
import { gt, asc } from 'drizzle-orm'
import { getDb } from '../src/drizzle/db'
import { genes, isoforms } from '../src/drizzle/schema'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(REPO_ROOT, 'public', 'data')
const GENES_DIR = join(OUT_DIR, 'genes')

type GeneRow = {
  id: string
  symbol: string
  name: string
  species: string
  alternateSymbols: string
}

type IsoformRow = {
  id: string
  geneId: string
  codingSequenceLength: number
  proteinSequenceLength: number
  codingSequence: string
  proteinSequence: string
  species: string
}

type GeneEntry = GeneRow & {
  isoforms: IsoformRow[]
}

function parseAlternates(s: string): string[] {
  if (!s) return []
  return s.split('|').filter((x) => x.length > 0)
}

async function main() {
  const skip =
    !process.env.DATABASE_URL &&
    existsSync(join(OUT_DIR, 'manifest.json')) &&
    existsSync(join(OUT_DIR, 'isoform-index.json'))
  if (skip) {
    console.log(
      '[emit-content] DATABASE_URL not set and cached artifacts exist — skipping',
    )
    return
  }

  console.log('[emit-content] reading from database…')
  const db = await getDb()
  const allGenes: GeneRow[] = await db
    .select({
      id: genes.id,
      symbol: genes.symbol,
      name: genes.name,
      species: genes.species,
      alternateSymbols: genes.alternateSymbols,
    })
    .from(genes)
  // Paginate by id — full table is >64MB, which exceeds Neon HTTP's response cap.
  const PAGE_SIZE = 5000
  const allIsoforms: IsoformRow[] = []
  let cursor = ''
  while (true) {
    const page = await db
      .select({
        id: isoforms.id,
        geneId: isoforms.geneId,
        codingSequenceLength: isoforms.codingSequenceLength,
        proteinSequenceLength: isoforms.proteinSequenceLength,
        codingSequence: isoforms.codingSequence,
        proteinSequence: isoforms.proteinSequence,
        species: isoforms.species,
      })
      .from(isoforms)
      .where(cursor === '' ? undefined : gt(isoforms.id, cursor))
      .orderBy(asc(isoforms.id))
      .limit(PAGE_SIZE)
    if (page.length === 0) break
    allIsoforms.push(...page)
    cursor = page[page.length - 1].id
    process.stdout.write(`\r[emit-content]   isoforms: ${allIsoforms.length}`)
    if (page.length < PAGE_SIZE) break
  }
  process.stdout.write('\n')
  console.log(
    `[emit-content] loaded ${allGenes.length} genes, ${allIsoforms.length} isoforms`,
  )

  // Group isoforms by gene id.
  const isoformsByGene = new Map<string, IsoformRow[]>()
  for (const iso of allIsoforms) {
    let arr = isoformsByGene.get(iso.geneId)
    if (!arr) {
      arr = []
      isoformsByGene.set(iso.geneId, arr)
    }
    arr.push(iso)
  }
  for (const list of isoformsByGene.values())
    list.sort((a, b) => a.id.localeCompare(b.id))

  // Filter out genes with empty symbols (not addressable in the URL).
  const namedGenes = allGenes.filter((g) => g.symbol.length > 0)

  // Group genes by symbol — same symbol may exist for human and mouse.
  const bySymbol = new Map<string, GeneEntry[]>()
  for (const g of namedGenes) {
    const list = bySymbol.get(g.symbol) ?? []
    const entry: GeneEntry = {
      ...g,
      isoforms: isoformsByGene.get(g.id) ?? [],
    }
    list.push(entry)
    bySymbol.set(g.symbol, list)
  }

  // Reset output dir.
  rmSync(GENES_DIR, { recursive: true, force: true })
  mkdirSync(GENES_DIR, { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })

  // Per-gene JSON files.
  for (const [symbol, entries] of bySymbol) {
    writeFileSync(
      join(GENES_DIR, `${symbol}.json`),
      JSON.stringify(entries),
      'utf8',
    )
  }

  // Manifest: list of {id, symbol, species} for sitemap + generateStaticParams,
  // also serves as the gene-id-to-symbol resolver for client search ENSG lookups.
  const manifestEntries = namedGenes
    .map((g) => ({ id: g.id, symbol: g.symbol, species: g.species }))
    .sort(
      (a, b) =>
        a.symbol.localeCompare(b.symbol) || a.species.localeCompare(b.species),
    )
  writeFileSync(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ genes: manifestEntries }),
    'utf8',
  )

  // Isoform → {symbol, species} index for /design-tool prefill and ENST search routing.
  const isoformIndex: Record<string, { symbol: string; species: string }> = {}
  const geneById = new Map<string, GeneRow>()
  for (const g of namedGenes) geneById.set(g.id, g)
  for (const iso of allIsoforms) {
    const g = geneById.get(iso.geneId)
    if (!g) continue // skip isoforms whose gene was filtered out
    isoformIndex[iso.id] = { symbol: g.symbol, species: g.species }
  }
  writeFileSync(
    join(OUT_DIR, 'isoform-index.json'),
    JSON.stringify(isoformIndex),
    'utf8',
  )

  // Client-side MiniSearch indexes, sharded by species. The combined index
  // exceeds 2 MB gzipped, so we emit one shard per species and the client
  // lazy-loads the right one based on the species filter (loading both when
  // species === 'both'). Field weights mirror the old ts_rank ladder:
  // symbol (5) > alternateSymbols (3) > name (1).
  type SearchDoc = {
    id: string
    geneId: string
    symbol: string
    name: string
    species: string
    alternateSymbols: string[]
  }
  const buildShard = (rows: GeneRow[]) => {
    const docs: SearchDoc[] = rows.map((g) => ({
      id: g.id,
      geneId: g.id,
      symbol: g.symbol,
      name: g.name,
      species: g.species,
      alternateSymbols: parseAlternates(g.alternateSymbols),
    }))
    const mini = new MiniSearch<SearchDoc>({
      fields: ['symbol', 'name', 'alternateSymbols'],
      storeFields: ['geneId', 'symbol', 'name', 'species'],
      tokenize: (text) =>
        text
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .filter(Boolean),
      searchOptions: {
        boost: { symbol: 5, alternateSymbols: 3, name: 1 },
        prefix: true,
        // Tight fuzzy. Biology symbols like "CFTR" should not match
        // "F2R" or other near-misses; prefix carries most of the
        // partial-match weight.
        fuzzy: 0.1,
      },
    })
    mini.addAll(docs)
    return mini.toJSON()
  }
  const speciesShards = new Set(namedGenes.map((g) => g.species))
  for (const species of speciesShards) {
    const shard = buildShard(namedGenes.filter((g) => g.species === species))
    writeFileSync(
      join(OUT_DIR, `search-index-${species}.json`),
      JSON.stringify(shard),
      'utf8',
    )
  }

  // Stats.
  const stat = (path: string) => {
    const { statSync } = require('fs')
    const bytes = statSync(path).size
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }
  console.log(`[emit-content] wrote:`)
  console.log(`  ${bySymbol.size} per-gene files in public/data/genes/`)
  console.log(`  manifest.json (${stat(join(OUT_DIR, 'manifest.json'))})`)
  console.log(
    `  isoform-index.json (${stat(join(OUT_DIR, 'isoform-index.json'))})`,
  )
  for (const species of speciesShards) {
    console.log(
      `  search-index-${species}.json (${stat(join(OUT_DIR, `search-index-${species}.json`))})`,
    )
  }
}

main().catch((err) => {
  console.error('[emit-content] failed:', err)
  process.exit(1)
})

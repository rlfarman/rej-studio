/**
 * Emit static gene/isoform content from Postgres to public/data/.
 *
 * Reads the gene + isoform tables once and writes:
 *   public/data/manifest.json          — { genes: [{id, symbol, species}] }
 *   public/data/isoform-index.json     — { [isoformId]: {symbol, species} }
 *   public/data/genes/<symbol>.json    — full gene + isoforms payload, including
 *                                        a precomputed identity matrix and
 *                                        baked-in disease associations
 *   public/data/search-index-<sp>.json — species-sharded MiniSearch indexes
 *
 * `proteinSequence` is NOT emitted — it's derivable from the coding sequence
 * via translation, and the only consumer (the identity matrix) gets the
 * precomputed matrix instead. `proteinSequenceLength` is also dropped; it's
 * derivable from `codingSequenceLength`.
 *
 * Idempotent: clears public/data/genes/ and rewrites everything. Safe to re-run.
 *
 * Skipped automatically when DATABASE_URL is missing AND artifacts already
 * exist (so CI builds work without a live DB once the artifacts are cached).
 *
 * Usage:
 *   pnpm content:emit
 *   tsx --env-file=.env scripts/emit-content.ts
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import MiniSearch from 'minisearch'
import { gt, asc } from 'drizzle-orm'
import { getDb } from '../src/drizzle/db'
import { genes, isoforms } from '../src/drizzle/schema'
import type {
  AssociationData,
  AssociationRow,
} from '../src/features/disease-associations/types'
import { translate } from '../src/lib/bio/genetic-code'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(REPO_ROOT, 'public', 'data')
const GENES_DIR = join(OUT_DIR, 'genes')
const ASSOCIATIONS_PATH = join(
  REPO_ROOT,
  'src',
  'features',
  'disease-associations',
  'data',
  'associations.json',
)

type GeneRow = {
  id: string
  symbol: string
  name: string
  species: string
  alternateSymbols: string
}

type IsoformDbRow = {
  id: string
  geneId: string
  codingSequenceLength: number
  proteinSequenceLength: number
  codingSequence: string
  proteinSequence: string
  species: string
}

type EmittedIsoform = {
  id: string
  geneId: string
  codingSequenceLength: number
  codingSequence: string
  species: string
}

type IdentityMatrix = {
  ids: string[]
  rows: number[][]
}

type GeneEntry = GeneRow & {
  isoforms: EmittedIsoform[]
  identityMatrix: IdentityMatrix
  association?: AssociationRow
}

const MAX_MATRIX_ISOFORMS = 16

function parseAlternates(s: string): string[] {
  if (!s) return []
  return s.split('|').filter((x) => x.length > 0)
}

/**
 * % protein-sequence identity from end-anchored prefix/suffix overlap. Mirrors
 * `proteinIdentity` in src/features/gene-search/components/isoform-identity-matrix.tsx;
 * keep them in sync. Most isoforms differ by exon inclusion, so they share
 * large contiguous blocks at the start and end.
 */
function proteinIdentity(a: string, b: string): number {
  if (a === b) return 100
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length === 0) return 0
  let prefix = 0
  while (prefix < shorter.length && shorter[prefix] === longer[prefix]) prefix++
  let suffix = 0
  while (
    suffix < shorter.length - prefix &&
    shorter[shorter.length - 1 - suffix] === longer[longer.length - 1 - suffix]
  ) {
    suffix++
  }
  return ((prefix + suffix) / longer.length) * 100
}

function computeIdentityMatrix(
  isoformsForGene: IsoformDbRow[],
): IdentityMatrix {
  // Sort by protein length descending so the longest isoform is in the
  // top-left corner (matches the runtime component's ordering).
  const sorted = [...isoformsForGene].sort(
    (a, b) => b.proteinSequenceLength - a.proteinSequenceLength,
  )
  const trimmed = sorted.slice(0, MAX_MATRIX_ISOFORMS)
  const ids = trimmed.map((i) => i.id)
  const rows = trimmed.map((a) =>
    trimmed.map((b) => proteinIdentity(a.proteinSequence, b.proteinSequence)),
  )
  return { ids, rows }
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
  const allIsoforms: IsoformDbRow[] = []
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

  // Disease associations are JSON-backed and human-only. Bake the row for each
  // human gene into its per-gene file so the page render needs no runtime lookup.
  const associationsBySymbol = new Map<string, AssociationRow>()
  if (existsSync(ASSOCIATIONS_PATH)) {
    const raw = readFileSync(ASSOCIATIONS_PATH, 'utf8')
    const parsed = JSON.parse(raw) as AssociationData
    for (const row of parsed.rows) {
      associationsBySymbol.set(row.symbol.toUpperCase(), row)
    }
    console.log(
      `[emit-content] loaded ${associationsBySymbol.size} disease associations`,
    )
  }

  const isoformsByGene = new Map<string, IsoformDbRow[]>()
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

  const namedGenes = allGenes.filter((g) => g.symbol.length > 0)

  // Validate that protein sequences match what we'd derive from CDS, so we
  // know it's safe to drop the column. Sample a few hundred isoforms.
  let mismatches = 0
  const SAMPLE = Math.min(allIsoforms.length, 500)
  for (let i = 0; i < SAMPLE; i++) {
    const iso = allIsoforms[Math.floor((i * allIsoforms.length) / SAMPLE)]
    // Strip trailing stop codon translation ('*') to compare against the
    // protein column, which historically excludes the stop.
    const derived = translate(iso.codingSequence).replace(/\*$/, '')
    if (derived !== iso.proteinSequence) mismatches++
  }
  if (mismatches > 0) {
    console.warn(
      `[emit-content] WARNING: ${mismatches}/${SAMPLE} sampled protein sequences differ from translated CDS. ` +
        `Components that derive protein from CDS may render slightly different content than what's in the DB.`,
    )
  }

  const bySymbol = new Map<string, GeneEntry[]>()
  for (const g of namedGenes) {
    const isos = isoformsByGene.get(g.id) ?? []
    const emittedIsos: EmittedIsoform[] = isos.map((i) => ({
      id: i.id,
      geneId: i.geneId,
      codingSequenceLength: i.codingSequenceLength,
      codingSequence: i.codingSequence,
      species: i.species,
    }))
    const entry: GeneEntry = {
      ...g,
      isoforms: emittedIsos,
      identityMatrix: computeIdentityMatrix(isos),
    }
    if (g.species === 'human') {
      const assoc = associationsBySymbol.get(g.symbol.toUpperCase())
      if (assoc) entry.association = assoc
    }
    const list = bySymbol.get(g.symbol) ?? []
    list.push(entry)
    bySymbol.set(g.symbol, list)
  }

  rmSync(GENES_DIR, { recursive: true, force: true })
  mkdirSync(GENES_DIR, { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })

  for (const [symbol, entries] of bySymbol) {
    writeFileSync(
      join(GENES_DIR, `${symbol}.json`),
      JSON.stringify(entries),
      'utf8',
    )
  }

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

  const isoformIndex: Record<string, { symbol: string; species: string }> = {}
  const geneById = new Map<string, GeneRow>()
  for (const g of namedGenes) geneById.set(g.id, g)
  for (const iso of allIsoforms) {
    const g = geneById.get(iso.geneId)
    if (!g) continue
    isoformIndex[iso.id] = { symbol: g.symbol, species: g.species }
  }
  writeFileSync(
    join(OUT_DIR, 'isoform-index.json'),
    JSON.stringify(isoformIndex),
    'utf8',
  )

  // MiniSearch shards by species. Combined index >2 MB gzipped, so split and
  // lazy-load on the client based on the active species filter.
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

  const stat = (path: string) =>
    `${(statSync(path).size / 1024 / 1024).toFixed(2)} MB`
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

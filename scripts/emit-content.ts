/**
 * Emit static gene/isoform content from a CSV directly to public/data/.
 *
 * The CSV is the single authoritative source. No Postgres, no JSONL, no
 * intermediate. Pass the CSV path as the first argument; the script writes
 * bucketed artifacts that ship with the repo.
 *
 * Usage:
 *   pnpm content:rebuild path/to/transcript_metadata.csv
 *   tsx scripts/emit-content.ts <csv-path>
 *
 * Outputs (everything alphabetically bucketed by first char of symbol so the
 * deploy file count stays well under Cloudflare's 20K static-asset cap):
 *   public/data/manifest.json                — { genes: [{id, symbol, species}] }
 *   public/data/isoform-index.json           — { [isoformId]: {symbol, species} }
 *   public/data/genes-meta/<bucket>.json     — { [symbol]: GeneMetaEntry[] }
 *   public/data/sequences/<bucket>.json      — { [isoformId]: codingSequence }
 *   public/data/search-index-<species>.json  — MiniSearch shards
 *
 * Sequences live in their own buckets, lazy-fetched only when the user expands
 * a row, opens the comparison sheet, or clicks copy/download. Most page loads
 * never hit them. Default-render metrics (suitability, GC%, CpG, WGGW) are
 * precomputed at emit time and baked into the gene metadata, so the page
 * payload carries numbers, not multi-kb sequences.
 */

import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse'
import MiniSearch from 'minisearch'
import type {
  AssociationData,
  AssociationRow,
} from '../src/features/disease-associations/types'
import {
  computeGcPercent,
  countCpG,
  rankWggwByBalance,
} from '../src/lib/bio/sequence-utils'
import {
  assessDesignSuitability,
  type Suitability,
} from '../src/lib/bio/design-suitability'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(REPO_ROOT, 'public', 'data')
const META_DIR = join(OUT_DIR, 'genes-meta')
const SEQ_DIR = join(OUT_DIR, 'sequences')
const ASSOCIATIONS_PATH = join(
  REPO_ROOT,
  'src',
  'features',
  'disease-associations',
  'data',
  'associations.json',
)

const MAX_MATRIX_ISOFORMS = 16

type CsvRow = {
  transcript_id: string
  gene_id: string
  gene_name: string
  coding_sequence_length: string
  protein_length: string
  coding_sequence: string
  protein_sequence: string
} & Record<string, string>

type GeneRow = {
  id: string
  symbol: string
  name: string
  species: string
  alternateSymbols: string[]
}

type ParsedIsoform = {
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
  species: string
  gcPercent: number
  cpgCount: number
  wggwCount: number
  suitability: Suitability
}

type IdentityMatrix = {
  ids: string[]
  rows: number[][]
}

type GeneMetaEntry = GeneRow & {
  isoforms: EmittedIsoform[]
  identityMatrix: IdentityMatrix
  association?: AssociationRow
}

function bucketOf(symbol: string): string {
  const c = symbol[0]?.toUpperCase() ?? '_'
  return /^[A-Z]$/.test(c) ? c : '_'
}

function speciesFromTranscriptId(id: string): string {
  return id.startsWith('ENSMUST') ? 'mouse' : 'human'
}

/**
 * Mirrors `proteinIdentity` in src/features/gene-search/components/isoform-identity-matrix.tsx.
 * End-anchored prefix/suffix overlap — most isoforms differ by exon inclusion,
 * so they share large contiguous blocks at the start and end.
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

function computeIdentityMatrix(isos: ParsedIsoform[]): IdentityMatrix {
  const sorted = [...isos].sort(
    (a, b) => b.proteinSequenceLength - a.proteinSequenceLength,
  )
  const trimmed = sorted.slice(0, MAX_MATRIX_ISOFORMS)
  const ids = trimmed.map((i) => i.id)
  const rows = trimmed.map((a) =>
    trimmed.map(
      (b) =>
        Math.round(proteinIdentity(a.proteinSequence, b.proteinSequence) * 10) /
        10,
    ),
  )
  return { ids, rows }
}

async function* readCsvRows(path: string): AsyncGenerator<CsvRow> {
  const stream = createReadStream(path).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
    }),
  )
  for await (const row of stream) yield row as CsvRow
}

function loadAssociations(): Map<string, AssociationRow> {
  const map = new Map<string, AssociationRow>()
  if (!existsSync(ASSOCIATIONS_PATH)) return map
  const raw = readFileSync(ASSOCIATIONS_PATH, 'utf8')
  const parsed = JSON.parse(raw) as AssociationData
  for (const row of parsed.rows) {
    map.set(row.symbol.toUpperCase(), row)
  }
  return map
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: tsx scripts/emit-content.ts <csv-path>')
    process.exit(1)
  }
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`)
    process.exit(1)
  }

  console.log(`[emit-content] reading ${csvPath}…`)
  const start = Date.now()

  const associations = loadAssociations()
  console.log(`[emit-content] loaded ${associations.size} disease associations`)

  // First pass: stream-parse CSV, accumulate genes + isoforms in memory.
  // Memory budget: ~143K isoforms × ~3KB CDS = ~400MB. Fits modern Node.
  const genes = new Map<string, GeneRow>()
  const isoformsByGene = new Map<string, ParsedIsoform[]>()
  let isoformCount = 0

  for await (const row of readCsvRows(csvPath)) {
    const transcriptId = row.transcript_id
    const geneId = row.gene_id
    if (!transcriptId || !geneId) continue
    const species = speciesFromTranscriptId(transcriptId)

    if (!genes.has(geneId)) {
      const symbols: string[] = []
      for (let i = 1; i <= 28; i++) {
        const v = row[`sym${i}`]
        if (v) symbols.push(v)
      }
      const primarySymbol = symbols[0] ?? row.gene_name ?? ''
      genes.set(geneId, {
        id: geneId,
        symbol: primarySymbol,
        name: row.gene_name,
        species,
        alternateSymbols: symbols.slice(1),
      })
    }

    const cds = row.coding_sequence ?? ''
    const protein = row.protein_sequence ?? ''
    const cdsLen = Number(row.coding_sequence_length) || cds.length
    const proteinLen =
      Number(row.protein_length) || protein.replace(/\*$/, '').length

    const iso: ParsedIsoform = {
      id: transcriptId,
      geneId,
      codingSequenceLength: cdsLen,
      proteinSequenceLength: proteinLen,
      codingSequence: cds,
      proteinSequence: protein,
      species,
    }
    let arr = isoformsByGene.get(geneId)
    if (!arr) {
      arr = []
      isoformsByGene.set(geneId, arr)
    }
    arr.push(iso)
    isoformCount++
    if (isoformCount % 25000 === 0) {
      process.stdout.write(`\r[emit-content]   parsed ${isoformCount}`)
    }
  }
  process.stdout.write('\n')
  console.log(
    `[emit-content] parsed ${genes.size} genes, ${isoformCount} isoforms in ${(
      (Date.now() - start) /
      1000
    ).toFixed(1)}s`,
  )

  // Reset output dirs.
  rmSync(META_DIR, { recursive: true, force: true })
  rmSync(SEQ_DIR, { recursive: true, force: true })
  rmSync(join(OUT_DIR, 'genes'), { recursive: true, force: true }) // legacy
  mkdirSync(META_DIR, { recursive: true })
  mkdirSync(SEQ_DIR, { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })

  // Second pass: precompute metrics, build per-bucket meta + sequence dicts.
  const metaByBucket = new Map<string, Map<string, GeneMetaEntry[]>>()
  const seqByBucket = new Map<string, Record<string, string>>()
  const isoformIndex: Record<
    string,
    { symbol: string; species: string; bucket: string }
  > = {}
  const namedGenes: GeneRow[] = []

  let processed = 0
  for (const [geneId, gene] of genes) {
    processed++
    if (processed % 5000 === 0) {
      process.stdout.write(`\r[emit-content]   computing metrics: ${processed}`)
    }
    if (!gene.symbol) continue
    namedGenes.push(gene)
    const isos = (isoformsByGene.get(geneId) ?? []).sort((a, b) =>
      a.id.localeCompare(b.id),
    )
    const bucket = bucketOf(gene.symbol)

    const emittedIsos: EmittedIsoform[] = isos.map((iso) => {
      const upperSeq = iso.codingSequence.toUpperCase()
      return {
        id: iso.id,
        geneId: iso.geneId,
        codingSequenceLength: iso.codingSequenceLength,
        species: iso.species,
        gcPercent: Math.round(computeGcPercent(upperSeq) * 10) / 10,
        cpgCount: countCpG(upperSeq),
        wggwCount: rankWggwByBalance(upperSeq).length,
        suitability: assessDesignSuitability(iso.codingSequence),
      }
    })

    const entry: GeneMetaEntry = {
      ...gene,
      isoforms: emittedIsos,
      identityMatrix: computeIdentityMatrix(isos),
    }
    if (gene.species === 'human') {
      const assoc = associations.get(gene.symbol.toUpperCase())
      if (assoc) entry.association = assoc
    }

    let metaBucket = metaByBucket.get(bucket)
    if (!metaBucket) {
      metaBucket = new Map()
      metaByBucket.set(bucket, metaBucket)
    }
    const list = metaBucket.get(gene.symbol) ?? []
    list.push(entry)
    metaBucket.set(gene.symbol, list)

    let seqBucket = seqByBucket.get(bucket)
    if (!seqBucket) {
      seqBucket = {}
      seqByBucket.set(bucket, seqBucket)
    }
    for (const iso of isos) {
      seqBucket[iso.id] = iso.codingSequence
      isoformIndex[iso.id] = {
        symbol: gene.symbol,
        species: gene.species,
        bucket,
      }
    }
  }
  process.stdout.write('\n')

  // Write bucketed metadata.
  for (const [bucket, geneMap] of metaByBucket) {
    const obj: Record<string, GeneMetaEntry[]> = {}
    for (const [symbol, entries] of geneMap) obj[symbol] = entries
    writeFileSync(join(META_DIR, `${bucket}.json`), JSON.stringify(obj), 'utf8')
  }

  // Write bucketed sequences.
  for (const [bucket, seqs] of seqByBucket) {
    writeFileSync(join(SEQ_DIR, `${bucket}.json`), JSON.stringify(seqs), 'utf8')
  }

  // Write manifest + isoform index.
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
  writeFileSync(
    join(OUT_DIR, 'isoform-index.json'),
    JSON.stringify(isoformIndex),
    'utf8',
  )

  // MiniSearch shards by species.
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
      alternateSymbols: g.alternateSymbols,
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
  console.log('[emit-content] wrote:')
  console.log(
    `  manifest.json           ${stat(join(OUT_DIR, 'manifest.json'))}`,
  )
  console.log(
    `  isoform-index.json      ${stat(join(OUT_DIR, 'isoform-index.json'))}`,
  )
  for (const species of speciesShards) {
    console.log(
      `  search-index-${species.padEnd(6)} ${stat(join(OUT_DIR, `search-index-${species}.json`))}`,
    )
  }
  console.log(`  ${metaByBucket.size} metadata buckets in genes-meta/`)
  console.log(`  ${seqByBucket.size} sequence buckets in sequences/`)
}

main().catch((err) => {
  console.error('[emit-content] failed:', err)
  process.exit(1)
})

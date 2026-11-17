/**
 * Build the disease-associations JSON from the OMIM curated CSV.
 *
 * Reads disease_associated_genes.csv and writes a pruned, parsed JSON file
 * that the app ships as a static asset
 * (src/features/disease-associations/data/associations.json). Only the four
 * scientifically interesting columns are kept (symbol, name, inheritance,
 * phenotypes), plus ensembl_gene_id for linking to /genes/<symbol>.
 *
 * If the gene seed's isoforms.jsonl exists (`pnpm data:genes`), each row also
 * gets `largestCds`: the longest coding sequence across the gene's human
 * isoforms. Without it, `largestCds` is null.
 *
 *   pnpm data:associations
 *   pnpm data:associations --csv path/to.csv --isoforms path/to/isoforms.jsonl
 *
 * Ported from scripts/build-disease-associations.py, whose output it matches
 * byte for byte. The committed associations.json is that output after
 * Oxfmt, which lint-staged applies on commit.
 */
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { column, readCsvDicts } from './lib/csv'
import { compareCodePoints, pyInt, pyStrip } from './lib/python-compat'
import type {
  AssociationData,
  AssociationRow,
  Phenotype,
} from '../src/features/disease-associations/types'

// Each OMIM phenotype record ends with: `NNNNNN (N), Inheritance` — or, for
// somatic / unspecified-inheritance records, just `NNNNNN (N)`. The name may
// contain commas, so anchor on the 6-digit MIM + mapping key. `[^\n]` and
// the optional `\n` before the end are Python's `.` and `$`.
const PHENO_RE = /^([^\n]*), (\d{6}) \(([1-4])\)(?:, ([^\n]+))?\n?$/

function parseInheritance(raw: string): string[] {
  return raw
    .split(';')
    .map(pyStrip)
    .filter((term) => term)
}

/** Parse one OMIM phenotype record, or null for an empty one. */
function parsePhenotypeRecord(raw: string): Phenotype | null {
  let record = pyStrip(raw)
  if (!record) return null

  // Strip OMIM status markers. See https://omim.org/help/faq for their meaning.
  let status: Phenotype['status'] = 'confirmed'
  if (record.startsWith('?')) {
    status = 'provisional'
    record = pyStrip(record.slice(1))
  } else if (record.startsWith('{') && record.includes('}')) {
    // {Foo}, ... — strip just the leading `{` and the first `}` after it.
    status = 'susceptibility'
    const close = record.indexOf('}')
    record = record.slice(1, close) + record.slice(close + 1)
  } else if (record.startsWith('[') && record.includes(']')) {
    status = 'nondisease'
    const close = record.indexOf(']')
    record = record.slice(1, close) + record.slice(close + 1)
  }

  const match = PHENO_RE.exec(record)
  if (!match) {
    return {
      name: record,
      mim: null,
      mappingKey: null,
      inheritance: null,
      status,
    }
  }
  const [, name, mim, key, inheritance] = match
  return {
    name: pyStrip(name),
    mim: pyInt(mim),
    mappingKey: pyInt(key) as Phenotype['mappingKey'],
    inheritance: inheritance ? pyStrip(inheritance) : null,
    status,
  }
}

function parsePhenotypes(raw: string | undefined): Phenotype[] {
  if (!raw) return []
  return raw
    .split(';')
    .map(parsePhenotypeRecord)
    .filter((record) => record !== null)
}

/** The longest human CDS per gene id, from the seed's isoforms.jsonl. */
async function loadMaxCdsByGene(path: string): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (!existsSync(path)) return result
  const lines = createInterface({
    input: createReadStream(path, 'utf8'),
    crlfDelay: Infinity,
  })
  for await (const line of lines) {
    if (!pyStrip(line)) continue
    const row = JSON.parse(line) as {
      geneId: string
      species?: string
      codingSequenceLength: number | string
    }
    if (row.species !== 'human') continue
    // Python's int(): truncates a number, parses a string.
    const length = row.codingSequenceLength
    const cds = typeof length === 'number' ? Math.trunc(length) : pyInt(length)
    if (cds > (result.get(row.geneId) ?? 0)) result.set(row.geneId, cds)
  }
  return result
}

const { values } = parseArgs({
  options: {
    csv: { type: 'string', default: 'data/disease_associated_genes.csv' },
    isoforms: { type: 'string', default: 'data/isoforms.jsonl' },
    out: {
      type: 'string',
      default: 'src/features/disease-associations/data/associations.json',
    },
  },
})

if (!existsSync(values.csv)) {
  console.error(`ERROR: ${values.csv} not found`)
  process.exit(1)
}

const maxCds = await loadMaxCdsByGene(values.isoforms)
if (maxCds.size) {
  console.log(
    `Loaded max CDS for ${maxCds.size} human genes from ${values.isoforms}`,
  )
} else {
  console.log(
    `No ${values.isoforms} found — associations rows will have largestCds=null (run \`pnpm data:genes\` first to fill it)`,
  )
}

const rows: AssociationRow[] = []
let unparsed = 0
for (const row of readCsvDicts(values.csv)) {
  const phenotypes = parsePhenotypes(column(row, 'phenotypes_omim'))
  unparsed += phenotypes.filter((p) => p.mim === null).length
  const ensemblGeneId = column(row, 'ensembl_gene_id_omim') || null
  rows.push({
    symbol: column(row, 'approved_gene_symbol')!,
    name: column(row, 'gene_name_omim')!,
    ensemblGeneId,
    inheritance: parseInheritance(column(row, 'inheritance_terms')!),
    phenotypes,
    largestCds: ensemblGeneId ? (maxCds.get(ensemblGeneId) ?? null) : null,
  })
}

rows.sort((a, b) => compareCodePoints(a.symbol, b.symbol))

const data: AssociationData = { rows }
await mkdir(dirname(values.out), { recursive: true })
// json.dump(indent=2, ensure_ascii=False) writes what JSON.stringify does
// for this data: strings, integers, nulls and arrays.
writeFileSync(values.out, `${JSON.stringify(data, null, 2)}\n`)

const totalPhenotypes = rows.reduce((n, row) => n + row.phenotypes.length, 0)
const sizeKb = (statSync(values.out).size / 1024).toFixed(1)
console.log(
  `Wrote ${rows.length} genes, ${totalPhenotypes} phenotypes (${unparsed} records without MIM) to ${values.out} (${sizeKb} KB)`,
)

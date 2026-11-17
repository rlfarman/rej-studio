/**
 * Build the static gene corpus (see src/features/gene-search/corpus/format.ts)
 * from the JSONL seed that scripts/build-db.py emits.
 *
 *   pnpm corpus:build                       # the committed sample → public/gene-data/sample
 *   pnpm corpus:build --genes data/genes.jsonl --isoforms data/isoforms.jsonl \
 *     --version v1 --out dist/gene-data     # the full corpus → dist/gene-data/v1
 *
 * Output goes to `<out>/<version>/`, which must not exist yet unless
 * `--force` is given: a published version is immutable, so rebuilding one in
 * place would let caches serve a mix of old and new files.
 *
 * Point VITE_GENE_DATA_URL at wherever `<out>/<version>` is served.
 */
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import {
  buildCorpus,
  type SeedIsoform,
} from '../src/features/gene-search/corpus/build'
import type { CorpusGene } from '../src/features/gene-search/corpus/format'
import { INDEX_PATH } from '../src/features/gene-search/corpus/format'

const { values } = parseArgs({
  options: {
    genes: { type: 'string', default: 'data/sample-genes.jsonl' },
    isoforms: { type: 'string', default: 'data/sample-isoforms.jsonl' },
    version: { type: 'string', default: 'sample' },
    out: { type: 'string', default: 'public/gene-data' },
    force: { type: 'boolean', default: false },
  },
})

async function* readJsonl<T>(path: string): AsyncGenerator<T> {
  if (!existsSync(path)) {
    throw new Error(`${path} not found — run \`pnpm db:build\` first.`)
  }
  const lines = createInterface({ input: createReadStream(path) })
  for await (const line of lines) {
    if (line.trim()) yield JSON.parse(line) as T
  }
}

async function collect<T>(rows: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const row of rows) out.push(row)
  return out
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

async function main() {
  const version = values.version
  if (!/^[A-Za-z0-9._-]+$/.test(version)) {
    throw new Error(`--version must be a plain path segment, got ${version}`)
  }
  const outDir = join(values.out, version)
  if (existsSync(outDir)) {
    if (!values.force) {
      throw new Error(
        `${outDir} already exists. Published versions are immutable; pick a new --version, or pass --force to rebuild a local one.`,
      )
    }
    await rm(outDir, { recursive: true })
  }

  const start = Date.now()
  const genes = await collect(readJsonl<CorpusGene>(values.genes))
  const isoforms = await collect(readJsonl<SeedIsoform>(values.isoforms))
  const corpus = buildCorpus(genes, isoforms, version)

  let totalBytes = 0
  let largest = { path: '', bytes: 0 }
  for (const [path, contents] of corpus.files) {
    const target = join(outDir, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents)
    const bytes = Buffer.byteLength(contents)
    totalBytes += bytes
    if (path.startsWith('genes/') && bytes > largest.bytes) {
      largest = { path, bytes }
    }
  }

  const index = Buffer.from(corpus.files.get(INDEX_PATH)!)
  const gzip = gzipSync(index, { level: 9 }).length
  const brotli = brotliCompressSync(index, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length
  const shardSizes = [...corpus.files]
    .filter(([path]) => path.startsWith('transcripts/'))
    .map(([, contents]) => Buffer.byteLength(contents))

  console.log(`Built corpus ${version} in ${outDir} (${Date.now() - start} ms)`)
  console.log(`  genes:       ${corpus.geneCount}`)
  console.log(`  isoforms:    ${corpus.isoformCount}`)
  if (corpus.skippedGenes || corpus.orphanIsoforms) {
    console.log(
      `  skipped:     ${corpus.skippedGenes} gene(s) without an id, ${corpus.orphanIsoforms} isoform(s) without a gene`,
    )
  }
  console.log(`  files:       ${corpus.files.size}`)
  console.log(`  total size:  ${mb(totalBytes)}`)
  console.log(
    `  index.json:  ${kb(index.length)} raw, ${kb(gzip)} gzip, ${kb(brotli)} brotli`,
  )
  console.log(
    `  transcripts: ${shardSizes.length} shard(s), largest ${kb(Math.max(...shardSizes))}`,
  )
  const symbolShards = [...corpus.files]
    .filter(([path]) => path.startsWith('symbols/'))
    .map(([path, contents]) => ({ path, bytes: Buffer.byteLength(contents) }))
    .sort((a, b) => b.bytes - a.bytes)
  console.log(
    `  symbols:     ${symbolShards.length} shard(s), largest ${symbolShards[0]?.path} (${kb(symbolShards[0]?.bytes ?? 0)})`,
  )
  console.log(
    `  largest gene file: ${largest.path} (${kb((await stat(join(outDir, largest.path))).size)})`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})

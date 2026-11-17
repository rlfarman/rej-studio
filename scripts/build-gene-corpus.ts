/**
 * Build the static gene corpus (see src/features/gene-search/corpus/format.ts)
 * from the JSONL seed that `pnpm data:genes` writes.
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
 *
 * Needs a Rust toolchain: each gene's isoform identities are aligned by the
 * crate in rust/ (`cargo run --release --example isoform-identities`), run
 * as a subprocess. See StoredIsoformIdentity in format.ts.
 */
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { spawn } from 'node:child_process'
import {
  buildCorpus,
  identityInputs,
  type IsoformIdentities,
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
    throw new Error(`${path} not found — run \`pnpm data:genes\` first.`)
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

const RUST_DIR = join(import.meta.dirname, '..', 'rust')

/**
 * Align each gene's isoforms with the Rust crate's `isoform-identities`
 * example (native and multi-threaded; the browser module deliberately lacks
 * it). Sends every gene's proteins on stdin as one JSON array and reads the
 * triangles back in the same order. Cargo's own output goes to our stderr.
 */
async function alignIsoforms(
  inputs: ReadonlyMap<string, string[]>,
): Promise<IsoformIdentities> {
  const geneIds = [...inputs.keys()]
  // rustup puts cargo in ~/.cargo/bin, which not every shell has on PATH
  // (scripts/build-optimizer-wasm.sh makes the same allowance).
  const cargoHome = join(process.env.HOME ?? '', '.cargo', 'bin', 'cargo')
  const cargo =
    process.env.CARGO ?? (existsSync(cargoHome) ? cargoHome : 'cargo')
  const child = spawn(
    cargo,
    ['run', '--release', '--quiet', '--example', 'isoform-identities'],
    { cwd: RUST_DIR, stdio: ['pipe', 'pipe', 'inherit'] },
  )
  const chunks: Buffer[] = []
  child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
  const exit = new Promise<number | null>((resolve, reject) => {
    child.on('error', (err: NodeJS.ErrnoException) =>
      reject(
        err.code === 'ENOENT'
          ? new Error(
              'cargo not found. The corpus build aligns isoforms in Rust: install rustup (https://rustup.rs), then run `rustup toolchain install` in rust/.',
            )
          : err,
      ),
    )
    child.on('close', resolve)
  })
  child.stdin.end(JSON.stringify(geneIds.map((id) => inputs.get(id))))
  const code = await exit
  if (code !== 0) throw new Error(`isoform-identities exited with ${code}`)

  const triangles = JSON.parse(
    Buffer.concat(chunks).toString('utf8'),
  ) as unknown
  if (!Array.isArray(triangles) || triangles.length !== geneIds.length) {
    throw new Error('isoform-identities returned the wrong number of genes')
  }
  return new Map(geneIds.map((id, i) => [id, triangles[i] as number[]]))
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

async function main() {
  const version = values.version
  if (!/^[A-Za-z0-9._-]+$/.test(version)) {
    throw new Error(`--version must be a plain path segment, got ${version}`)
  }
  const outDir = join(values.out, version)
  if (existsSync(outDir) && !values.force) {
    throw new Error(
      `${outDir} already exists. Published versions are immutable; pick a new --version, or pass --force to rebuild a local one.`,
    )
  }

  const start = Date.now()
  const genes = await collect(readJsonl<CorpusGene>(values.genes))
  const isoforms = await collect(readJsonl<SeedIsoform>(values.isoforms))
  const inputs = identityInputs(isoforms)
  const alignStart = Date.now()
  const identities = await alignIsoforms(inputs)
  const alignMs = Date.now() - alignStart
  const corpus = buildCorpus(genes, isoforms, version, identities)
  // Only now: a failed alignment leaves the previous build in place.
  if (existsSync(outDir)) await rm(outDir, { recursive: true })

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
  const pairs = [...inputs.values()].reduce(
    (sum, proteins) => sum + (proteins.length * (proteins.length - 1)) / 2,
    0,
  )
  console.log(
    `  identities:  ${inputs.size} genes, ${pairs} pairs, ${alignMs} ms (including cargo's build check)`,
  )
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

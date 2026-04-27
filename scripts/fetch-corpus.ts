/**
 * Download and extract the prebuilt PGlite corpus tarball pinned in
 * package.json's `corpus` field. Replaces the CSV → Python → SQL pipeline
 * for contributors who want the full gene/isoform corpus locally.
 *
 *   pnpm db:fetch
 *
 * Idempotent: a no-op when data/local.db/.corpus-version matches the pinned
 * version. Verifies SHA-256 against package.json before extracting.
 *
 * Maintainers (re)publish a corpus version like so:
 *   pnpm db:build && pnpm db:push && pnpm db:upload
 *   tar czf rej-corpus-<version>.tar.gz -C data local.db
 *   sha256sum rej-corpus-<version>.tar.gz
 *   gh release create corpus-<version> rej-corpus-<version>.tar.gz
 *   # then bump package.json's corpus.{version,url,sha256} and open a PR
 */
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

type CorpusManifest = {
  version: string
  url: string
  sha256: string
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  corpus?: CorpusManifest
}
const manifest = pkg.corpus

if (!manifest || manifest.url.includes('PLACEHOLDER')) {
  console.error(
    'No corpus version pinned in package.json yet. The first tarball must be\n' +
      'published by a maintainer. See AGENTS.md → "Local dev tiers".',
  )
  process.exit(1)
}

const DB_DIR = 'data/local.db'
const STAMP = `${DB_DIR}/.corpus-version`
const CACHE_DIR = '.cache'

async function main() {
  if (existsSync(STAMP)) {
    const current = readFileSync(STAMP, 'utf8').trim()
    if (current === manifest!.version) {
      console.log(`Corpus ${manifest!.version} already present.`)
      return
    }
    console.log(`Replacing corpus ${current} with ${manifest!.version}…`)
  } else {
    console.log(`Fetching corpus ${manifest!.version}…`)
  }

  await mkdir(CACHE_DIR, { recursive: true })
  const tarPath = `${CACHE_DIR}/rej-corpus-${manifest!.version}.tar.gz`

  const res = await fetch(manifest!.url)
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: HTTP ${res.status}`)
  }
  await pipeline(
    Readable.fromWeb(
      res.body as unknown as import('stream/web').ReadableStream,
    ),
    createWriteStream(tarPath),
  )

  const hash = createHash('sha256').update(readFileSync(tarPath)).digest('hex')
  if (hash !== manifest!.sha256) {
    throw new Error(
      `SHA-256 mismatch for ${tarPath}\n  expected: ${manifest!.sha256}\n  actual:   ${hash}`,
    )
  }

  await rm(DB_DIR, { recursive: true, force: true })
  await mkdir('data', { recursive: true })
  execSync(`tar xzf ${tarPath} -C data`, { stdio: 'inherit' })
  await writeFile(STAMP, manifest!.version)

  console.log(`Corpus ${manifest!.version} ready at ${DB_DIR}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

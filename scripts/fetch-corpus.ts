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
 * Uses `gh release download` so auth flows through the contributor's existing
 * `gh auth login` — required because rej-studio is a private repo. Public
 * repos could swap this for a plain `fetch(url)` against the public CDN URL.
 *
 * Maintainers (re)publish a corpus version like so:
 *   # build data/local.db/ from Neon
 *   tar czf rej-corpus-<version>.tar.gz -C data local.db
 *   shasum -a 256 rej-corpus-<version>.tar.gz
 *   gh release create corpus-<version> --title "Corpus <version>" --notes "..."
 *   gh release upload corpus-<version> rej-corpus-<version>.tar.gz
 *   # then bump package.json's corpus.{version,sha256} and open a PR
 */
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

type CorpusManifest = {
  version: string
  tag: string
  asset: string
  sha256: string
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  corpus?: CorpusManifest
}
const manifest = pkg.corpus

if (
  !manifest ||
  manifest.version === 'PLACEHOLDER' ||
  manifest.sha256 === 'PLACEHOLDER'
) {
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

  // Verify gh CLI is available (contributors already need it; surface the
  // requirement clearly if not).
  try {
    execSync('gh auth status', { stdio: 'ignore' })
  } catch {
    console.error(
      'gh CLI is required (rej-studio is a private repo, so the corpus\n' +
        'tarball is fetched via authenticated `gh release download`). Install\n' +
        'from https://cli.github.com/ and run `gh auth login`.',
    )
    process.exit(1)
  }

  await mkdir(CACHE_DIR, { recursive: true })
  const tarPath = `${CACHE_DIR}/${manifest!.asset}`

  // Remove any stale partial from a previous failed download.
  await rm(tarPath, { force: true })

  console.log(`Downloading ${manifest!.tag}/${manifest!.asset}…`)
  execSync(
    `gh release download ${manifest!.tag} --pattern '${manifest!.asset}' --dir ${CACHE_DIR}`,
    { stdio: 'inherit' },
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

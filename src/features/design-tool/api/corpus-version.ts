/**
 * Which gene corpus this deployment is serving, for the run record.
 *
 * A run record is only worth having if every field in it is true, so this
 * returns undefined rather than a guess. There are two ways to know:
 *
 * - `CORPUS_VERSION`, which a deployment sets to name the dataset loaded into
 *   its database. Nothing else can know what was uploaded to a Neon instance.
 * - The stamp `pnpm db:fetch` leaves in the local PGlite data directory, which
 *   names the prebuilt corpus release that was extracted there.
 *
 * With neither, the corpus is unknown and the record simply omits it. A
 * sequence pasted by hand has no corpus either way.
 */
export async function getCorpusVersion(): Promise<string | undefined> {
  const declared = process.env.CORPUS_VERSION?.trim()
  if (declared) {
    return declared
  }

  const dataDir = pgliteDataDir()
  if (!dataDir) {
    return undefined
  }

  try {
    const { readFile } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    const stamp = await readFile(resolve(dataDir, '.corpus-version'), 'utf8')
    return stamp.trim() || undefined
  } catch {
    // No stamp: the sample seed, or a corpus loaded some other way.
    return undefined
  }
}

/**
 * The local PGlite directory, when that is what the app is reading from.
 *
 * Mirrors the driver selection in `src/drizzle/db.ts`: PGlite is in use when
 * DATABASE_URL is empty, a `file:` path, or `memory://`.
 */
function pgliteDataDir(): string | undefined {
  const url = process.env.DATABASE_URL ?? ''
  // An in-memory database has no directory, and so no corpus stamp.
  if (url === 'memory://') {
    return undefined
  }
  if (url === '') {
    return 'data/local.db'
  }
  if (url.startsWith('file:')) {
    return url.slice('file:'.length)
  }
  return undefined
}

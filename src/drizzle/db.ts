import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

const isDev = process.env.NODE_ENV === 'development'
const databaseUrl = process.env.DATABASE_URL ?? ''

// PGlite (embedded Postgres) for local development and CI.
// Activates when DATABASE_URL is empty, a file path, or 'memory://'.
// Full PostgreSQL compatibility — tsvector, GIN indexes, etc. all work.
// Production is guarded by env.ts which requires a postgres:// URL.
const usePglite =
  databaseUrl === '' ||
  databaseUrl.startsWith('file:') ||
  databaseUrl.startsWith('memory:')

const devLogger = {
  logQuery(query: string, params: unknown[]) {
    if (isDev) {
      const truncated = query.length > 200 ? query.slice(0, 200) + '…' : query
      console.debug(`[drizzle] ${truncated}`, params.length > 0 ? params : '')
    }
  },
}

// Both Neon-HTTP and PGlite extend PgDatabase with their own HKT param.
// Typing the singleton as the polymorphic base lets us share one return
// type across drivers without nominal-cast noise at call sites.
type Db = PgDatabase<PgQueryResultHKT, typeof schema>

function createNeonDb(): Db {
  const sql = neon(databaseUrl)
  return drizzleNeon(sql, { schema, logger: devLogger })
}

// Lazy PGlite singleton — resolved on first query via getDb().
let pgliteDb: Db | null = null
let pgliteInitPromise: Promise<Db> | null = null

type GeneRow = typeof schema.genes.$inferInsert
type IsoformRow = typeof schema.isoforms.$inferInsert

async function bootstrapPglite(db: Db): Promise<void> {
  const { readFileSync, existsSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  const genesPath = resolve(process.cwd(), 'data/sample-genes.jsonl')
  const isoformsPath = resolve(process.cwd(), 'data/sample-isoforms.jsonl')
  if (!existsSync(genesPath) || !existsSync(isoformsPath)) {
    console.log(
      '[pglite] Schema applied; sample seed not found, skipping seed.',
    )
    return
  }

  const geneRows = readFileSync(genesPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as GeneRow)
  const isoformRows = readFileSync(isoformsPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as IsoformRow)

  // Batched inserts via Drizzle. PGlite has a parameter ceiling per query
  // (~65k), so chunk to keep us safely under it for both tables.
  const BATCH = 500
  for (let i = 0; i < geneRows.length; i += BATCH) {
    await db.insert(schema.genes).values(geneRows.slice(i, i + BATCH))
  }
  for (let i = 0; i < isoformRows.length; i += BATCH) {
    await db.insert(schema.isoforms).values(isoformRows.slice(i, i + BATCH))
  }

  console.log(
    `[pglite] Bootstrapped schema and loaded sample seed (${geneRows.length} genes, ${isoformRows.length} isoforms).`,
  )
}

type PGliteClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
  exec: (sql: string) => Promise<unknown>
}

/**
 * If a published tarball was built before drizzle's migration tracking was
 * wired up, the schema exists but `drizzle.__drizzle_migrations` doesn't —
 * which makes the migrator try to re-run `0000_initial` and fail with
 * "relation \"genes\" already exists". Stamp the existing migration as
 * applied so future migrations forward-apply cleanly.
 */
async function backfillMigrationTracking(
  client: PGliteClient,
  hasGenes: boolean,
): Promise<void> {
  if (!hasGenes) return
  const tracking = (await client.query(
    `SELECT to_regclass('drizzle.__drizzle_migrations') AS t`,
  )) as { rows: Array<{ t: string | null }> }
  if (tracking.rows[0]?.t) return

  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const { createHash } = await import('node:crypto')

  // Drizzle hashes the joined migration SQL (semicolons normalized,
  // breakpoints stripped). Approximate via the same transform readMigrationFiles
  // applies — see drizzle-orm/migrator.ts.
  const sqlText = readFileSync(
    resolve(process.cwd(), 'src/drizzle/migrations/0000_initial.sql'),
    'utf8',
  )
  const statements = sqlText
    .replace(/\n*--.*?\n/g, '')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)
  const hash = createHash('sha256').update(statements.join('')).digest('hex')

  await client.exec(`CREATE SCHEMA IF NOT EXISTS drizzle`)
  await client.exec(
    `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
       id SERIAL PRIMARY KEY,
       hash text NOT NULL,
       created_at bigint
     )`,
  )
  await client.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
    [hash, Date.now()],
  )
  console.log('[pglite] Backfilled migration tracking for legacy tarball.')
}

async function initPglite(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')

  let dataDir: string | undefined
  if (databaseUrl.startsWith('file:')) {
    dataDir = databaseUrl.slice(5)
  } else if (databaseUrl.startsWith('memory:')) {
    dataDir = undefined
  } else {
    dataDir = './data/local.db'
  }

  const client = new PGlite(dataDir)
  console.log(`[pglite] Using embedded Postgres (${dataDir ?? 'in-memory'})`)

  // PGlite's public client surface (.query, .exec) is what our helpers need.
  const rawClient = client as unknown as PGliteClient

  const wasEmpty = !(await tablesExist(rawClient))
  await backfillMigrationTracking(rawClient, !wasEmpty)

  const db: Db = drizzlePglite(client, { schema, logger: devLogger })

  // Apply any pending migrations. Idempotent: tracked in
  // drizzle.__drizzle_migrations.
  await migrate(db as Parameters<typeof migrate>[0], {
    migrationsFolder: 'src/drizzle/migrations',
  })

  // Only seed when the DB had no schema before this boot. A populated
  // tarball already has rows; we don't want to re-insert the sample seed
  // on top of the full corpus.
  if (wasEmpty) {
    await bootstrapPglite(db)
  }

  await logPgliteTier(rawClient, dataDir)

  pgliteDb = db
  return pgliteDb
}

async function tablesExist(client: PGliteClient): Promise<boolean> {
  const r = await client.query(`SELECT to_regclass('public.genes') AS exists`)
  return Boolean((r.rows[0] as { exists: string | null } | undefined)?.exists)
}

async function logPgliteTier(
  client: PGliteClient,
  dataDir: string | undefined,
): Promise<void> {
  const { existsSync, readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  const result = await client.query(`SELECT count(*)::int AS c FROM genes`)
  const geneCount = (result.rows[0] as { c: number } | undefined)?.c ?? 0

  const stamp =
    dataDir && existsSync(resolve(dataDir, '.corpus-version'))
      ? readFileSync(resolve(dataDir, '.corpus-version'), 'utf8').trim()
      : null

  if (stamp) {
    console.log(`[pglite] Full corpus (${stamp}, ${geneCount} genes).`)
  } else if (geneCount < 100) {
    console.log(
      `[pglite] Sample seed (${geneCount} genes). Run \`pnpm db:fetch\` for the full corpus.`,
    )
  } else {
    console.log(`[pglite] Local corpus (${geneCount} genes, unversioned).`)
  }
}

/**
 * Get the database instance. Always use this in code that may run with PGlite.
 * Resolves instantly with Neon; lazy-boots PGlite on first call.
 */
export async function getDb(): Promise<Db> {
  if (!usePglite) return neonDb
  if (pgliteDb) return pgliteDb
  if (!pgliteInitPromise) pgliteInitPromise = initPglite()
  return pgliteInitPromise
}

// Synchronous Neon instance for production. Not used when usePglite is true.
const neonDb: Db = usePglite ? (null as unknown as Db) : createNeonDb()

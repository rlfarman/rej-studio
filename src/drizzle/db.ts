import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
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

function createNeonDb() {
  // Enable connection caching on the Neon proxy. This lets the proxy reuse
  // compute node lookups across HTTP requests, shaving ~10ms off query latency.
  neonConfig.fetchConnectionCache = true
  const sql = neon(databaseUrl)
  return drizzleNeon(sql, { schema, logger: devLogger })
}

// Use Neon type as the base — the Drizzle query builder API is identical
// across all PostgreSQL drivers.
type Db = ReturnType<typeof drizzleNeon>

// Lazy PGlite singleton — resolved on first query via getDb().
let pgliteDb: Db | null = null
let pgliteInitPromise: Promise<Db> | null = null

async function initPglite(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite')

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

  pgliteDb = drizzlePglite(client, {
    schema,
    logger: devLogger,
  }) as unknown as Db
  return pgliteDb
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

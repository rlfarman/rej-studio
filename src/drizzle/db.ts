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
  const sql = neon(databaseUrl)
  return drizzleNeon(sql, { schema, logger: devLogger })
}

// Use Neon type as the base — the Drizzle query builder API is identical
// across all PostgreSQL drivers.
type Db = ReturnType<typeof drizzleNeon>

// Lazy PGlite singleton — resolved on first query via getDb().
let pgliteDb: Db | null = null
let pgliteInitPromise: Promise<Db> | null = null

type PGliteClient = { exec: (sql: string) => Promise<unknown> }

async function bootstrapPglite(client: PGliteClient): Promise<void> {
  const { readFileSync, existsSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  const migrationPath = resolve(
    process.cwd(),
    'src/drizzle/migrations/0000_initial.sql',
  )
  const migrationSql = readFileSync(migrationPath, 'utf8')
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const stmt of statements) {
    await client.exec(stmt)
  }

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
    .map((l) => JSON.parse(l) as Record<string, unknown>)
  const isoformRows = readFileSync(isoformsPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>)

  const escape = (v: unknown) =>
    v === null || v === undefined
      ? 'NULL'
      : typeof v === 'number'
        ? String(v)
        : `'${String(v).replace(/'/g, "''")}'`

  for (const g of geneRows) {
    await client.exec(
      `INSERT INTO genes (id, symbol, name, species, alternate_symbols) VALUES (${escape(g.id)}, ${escape(g.symbol)}, ${escape(g.name)}, ${escape(g.species)}, ${escape(g.alternateSymbols ?? '')});`,
    )
  }
  for (const i of isoformRows) {
    await client.exec(
      `INSERT INTO isoforms (id, gene_id, coding_sequence_length, protein_length, coding_sequence, protein_sequence, species) VALUES (${escape(i.id)}, ${escape(i.geneId)}, ${escape(i.codingSequenceLength)}, ${escape(i.proteinSequenceLength)}, ${escape(i.codingSequence ?? '')}, ${escape(i.proteinSequence ?? '')}, ${escape(i.species)});`,
    )
  }

  console.log(
    `[pglite] Bootstrapped schema and loaded sample seed (${geneRows.length} genes, ${isoformRows.length} isoforms).`,
  )
}

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

  // First-run bootstrap: if the genes table is missing, apply the migration
  // and load the sample seed so search works out of the box.
  const tableCheck = (await client.query(
    `SELECT to_regclass('public.genes') AS exists`,
  )) as { rows: Array<{ exists: string | null }> }
  if (!tableCheck.rows[0]?.exists) {
    await bootstrapPglite(client as unknown as PGliteClient)
  }

  await logPgliteTier(client, dataDir)

  pgliteDb = drizzlePglite(client, {
    schema,
    logger: devLogger,
  }) as unknown as Db
  return pgliteDb
}

async function logPgliteTier(
  client: { query: (sql: string) => Promise<unknown> },
  dataDir: string | undefined,
): Promise<void> {
  const { existsSync, readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  const result = (await client.query(
    `SELECT count(*)::int AS c FROM genes`,
  )) as {
    rows: Array<{ c: number }>
  }
  const geneCount = result.rows[0]?.c ?? 0

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

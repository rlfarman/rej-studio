/**
 * PGlite test database helper.
 *
 * Creates an in-memory Postgres instance with the production schema
 * applied. Use `getTestDb()` in integration tests that need real SQL.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { SelectGene, SelectIsoform } from '@/drizzle/schema'

// Dynamic imports because PGlite is ESM-only and heavy.
let testDb: Awaited<ReturnType<typeof createPGliteDb>> | null = null

async function createPGliteDb() {
  const { PGlite } = await import('@electric-sql/pglite')
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm')
  const { drizzle } = await import('drizzle-orm/pglite')
  const schema = await import('@/drizzle/schema')

  // Explicit 'memory://': PGlite ignores its options (extensions included)
  // when no data directory is given.
  const client = new PGlite('memory://', { extensions: { pg_trgm } })
  const db = drizzle({ client, schema })

  // Apply every committed migration in order, like production, so the
  // search queries run against the same trigram indexes.
  const migrationsDir = resolve(process.cwd(), 'src/drizzle/migrations')
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const statements = readFileSync(resolve(migrationsDir, file), 'utf-8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      await client.exec(stmt)
    }
  }

  return { db, client, schema }
}

export async function getTestDb() {
  if (!testDb) {
    testDb = await createPGliteDb()
  }
  return testDb
}

export async function seedGenes(
  db: Awaited<ReturnType<typeof getTestDb>>['db'],
  data: SelectGene[],
) {
  const schema = (await getTestDb()).schema
  if (data.length === 0) return
  await db.insert(schema.genes).values(data)
}

export async function seedIsoforms(
  db: Awaited<ReturnType<typeof getTestDb>>['db'],
  data: SelectIsoform[],
) {
  const schema = (await getTestDb()).schema
  if (data.length === 0) return
  await db.insert(schema.isoforms).values(data)
}

export async function cleanDb(db: Awaited<ReturnType<typeof getTestDb>>['db']) {
  const { sql } = await import('drizzle-orm')
  await db.execute(sql`DELETE FROM isoforms`)
  await db.execute(sql`DELETE FROM genes`)
}

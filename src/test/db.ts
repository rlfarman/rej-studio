/**
 * PGlite test database helper.
 *
 * Creates an in-memory Postgres instance with the production schema
 * applied. Use `getTestDb()` in integration tests that need real SQL.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type {
  genes,
  isoforms,
  SelectGene,
  SelectIsoform,
} from '@/drizzle/schema'

// Dynamic imports because PGlite is ESM-only and heavy.
let testDb: Awaited<ReturnType<typeof createPGliteDb>> | null = null

async function createPGliteDb() {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const schema = await import('@/drizzle/schema')

  const client = new PGlite()
  const db = drizzle({ client, schema })

  // Apply the migration SQL directly
  const migrationPath = resolve(
    process.cwd(),
    'src/drizzle/migrations/0000_initial.sql',
  )
  const migrationSql = readFileSync(migrationPath, 'utf-8')

  // Split on --> statement-breakpoint and execute each statement
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const stmt of statements) {
    await client.exec(stmt)
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

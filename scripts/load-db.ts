/**
 * Load the JSONL seed (built by scripts/build-db.py) into whatever DB the
 * Drizzle client in src/drizzle/db.ts is currently pointed at.
 *
 * Dialect-neutral: uses Drizzle's query builder for DDL and batched INSERTs,
 * so switching the underlying DB only requires updating db.ts + schema.ts.
 *
 * Usage:
 *   DATABASE_URL=... pnpm tsx scripts/load-db.ts
 */

import { readFileSync, existsSync } from 'fs'
import { sql } from 'drizzle-orm'
import { getDb } from '../src/drizzle/db'
import { genes, isoforms } from '../src/drizzle/schema'

const GENES_JSONL = 'data/genes.jsonl'
const ISOFORMS_JSONL = 'data/isoforms.jsonl'
const BATCH_SIZE = 500

type GeneRow = typeof genes.$inferInsert
type IsoformRow = typeof isoforms.$inferInsert

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) {
    throw new Error(`${path} not found — run \`pnpm db:build\` first.`)
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T)
}

async function insertInBatches<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>,
  label: string,
) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    await insert(batch)
    if (
      (i + batch.length) % (BATCH_SIZE * 10) === 0 ||
      i + batch.length === rows.length
    ) {
      console.log(`  ${label}: ${i + batch.length}/${rows.length}`)
    }
  }
}

async function main() {
  const start = Date.now()
  const db = await getDb()

  console.log('Reading JSONL...')
  const geneRows = readJsonl<GeneRow>(GENES_JSONL)
  const isoformRows = readJsonl<IsoformRow>(ISOFORMS_JSONL)
  console.log(`  ${geneRows.length} genes, ${isoformRows.length} isoforms`)

  console.log('Truncating tables...')
  // Order matters: isoforms has an FK to genes.
  await db.execute(sql`DELETE FROM ${isoforms}`)
  await db.execute(sql`DELETE FROM ${genes}`)

  console.log('Inserting genes...')
  await insertInBatches(
    geneRows,
    (batch) => db.insert(genes).values(batch),
    'genes',
  )

  console.log('Inserting isoforms...')
  await insertInBatches(
    isoformRows,
    (batch) => db.insert(isoforms).values(batch),
    'isoforms',
  )

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`Done in ${elapsed}s`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

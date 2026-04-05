/**
 * Verify that the FK and unique constraints declared in schema.ts are
 * actually enforced by the live database.
 *
 * Runs against whatever DATABASE_URL is set — in CI this is an ephemeral
 * Postgres created by the db-ci workflow; locally it's your dev Neon.
 *
 * Assertions:
 *   1. isoforms.gene_id FK → genes.id
 *   2. genes.id is unique (PK)
 *   3. isoforms.id is unique (PK)
 *
 * Usage: DATABASE_URL=... pnpm tsx scripts/verify-schema.ts
 */

import { sql } from 'drizzle-orm'
import { db } from '../src/drizzle/db'
import { genes, isoforms } from '../src/drizzle/schema'

let failures = 0

function assert(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ✓ ${label}`)
  } else {
    console.error(`  ✗ ${label}`)
    failures++
  }
}

async function main() {
  console.log('Schema constraint tests\n')

  // 1. PK uniqueness — attempt a duplicate insert on genes.id
  console.log('Primary key enforcement:')
  const sentinelGeneId = '__schema_test_gene__'
  const sentinelIsoformId = '__schema_test_isoform__'

  try {
    // Clean up any prior test rows
    await db.execute(
      sql`DELETE FROM ${isoforms} WHERE ${isoforms.id} = ${sentinelIsoformId}`,
    )
    await db.execute(
      sql`DELETE FROM ${genes} WHERE ${genes.id} = ${sentinelGeneId}`,
    )

    // Insert a gene
    await db.insert(genes).values({
      id: sentinelGeneId,
      symbol: 'TEST',
      name: 'Test Gene',
      species: 'human',
      alternateSymbols: '',
    })

    // Try duplicate — should fail
    let duplicateRejected = false
    try {
      await db.insert(genes).values({
        id: sentinelGeneId,
        symbol: 'TEST2',
        name: 'Test Gene 2',
        species: 'human',
        alternateSymbols: '',
      })
    } catch {
      duplicateRejected = true
    }
    assert('genes.id PK rejects duplicates', duplicateRejected)

    // 2. FK enforcement — insert isoform with a nonexistent gene_id
    console.log('\nForeign key enforcement:')
    let fkRejected = false
    try {
      await db.insert(isoforms).values({
        id: sentinelIsoformId,
        geneId: '__nonexistent_gene__',
        codingSequenceLength: 0,
        proteinSequenceLength: 0,
        codingSequence: '',
        proteinSequence: '',
        species: 'human',
      })
    } catch {
      fkRejected = true
    }
    assert('isoforms.gene_id FK rejects nonexistent genes.id', fkRejected)

    // 3. Valid FK insert + isoform PK uniqueness
    await db.insert(isoforms).values({
      id: sentinelIsoformId,
      geneId: sentinelGeneId,
      codingSequenceLength: 0,
      proteinSequenceLength: 0,
      codingSequence: '',
      proteinSequence: '',
      species: 'human',
    })

    let isoformDuplicateRejected = false
    try {
      await db.insert(isoforms).values({
        id: sentinelIsoformId,
        geneId: sentinelGeneId,
        codingSequenceLength: 1,
        proteinSequenceLength: 1,
        codingSequence: 'ATG',
        proteinSequence: 'M',
        species: 'human',
      })
    } catch {
      isoformDuplicateRejected = true
    }
    assert('isoforms.id PK rejects duplicates', isoformDuplicateRejected)

    // 4. FK cascade / restrict — deleting a gene with isoforms should fail
    console.log('\nFK restrict enforcement:')
    let deleteRestricted = false
    try {
      await db.execute(
        sql`DELETE FROM ${genes} WHERE ${genes.id} = ${sentinelGeneId}`,
      )
    } catch {
      deleteRestricted = true
    }
    assert(
      'cannot DELETE gene with existing isoforms (FK restrict)',
      deleteRestricted,
    )
  } finally {
    // Clean up test rows
    await db.execute(
      sql`DELETE FROM ${isoforms} WHERE ${isoforms.id} = ${sentinelIsoformId}`,
    )
    await db.execute(
      sql`DELETE FROM ${genes} WHERE ${genes.id} = ${sentinelGeneId}`,
    )
  }

  console.log(
    `\n${failures === 0 ? 'All tests passed.' : `${failures} test(s) failed.`}`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

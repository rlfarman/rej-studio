/**
 * Annotate src/features/disease-associations/data/associations.json with the
 * `largestCds` field — the max coding_sequence_length across each gene's
 * human isoforms. Queries whatever DB the Drizzle client is pointed at
 * (Neon in prod, PGlite locally if `data/isoforms.jsonl` has been loaded).
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/enrich-disease-associations.ts
 *
 * Run this after every `pnpm db:upload` so associations.json stays in sync
 * with the latest isoform seed.
 */

import { readFileSync, writeFileSync } from 'fs'
import { sql } from 'drizzle-orm'
import { getDb } from '../src/drizzle/db'
import { isoforms } from '../src/drizzle/schema'
import type { AssociationData } from '../src/features/disease-associations/types'

const ASSOCIATIONS_PATH =
  'src/features/disease-associations/data/associations.json'

async function main() {
  const db = await getDb()

  const rows = await db
    .select({
      geneId: isoforms.geneId,
      maxCds: sql<number>`max(${isoforms.codingSequenceLength})`,
    })
    .from(isoforms)
    .where(sql`${isoforms.species} = 'human'`)
    .groupBy(isoforms.geneId)

  const maxCdsByGeneId = new Map(rows.map((r) => [r.geneId, Number(r.maxCds)]))
  console.log(`Fetched max CDS for ${maxCdsByGeneId.size} human genes`)

  const associations = JSON.parse(
    readFileSync(ASSOCIATIONS_PATH, 'utf8'),
  ) as AssociationData

  let matched = 0
  for (const row of associations.rows) {
    const cds = row.ensemblGeneId
      ? (maxCdsByGeneId.get(row.ensemblGeneId) ?? null)
      : null
    row.largestCds = cds
    if (cds !== null) matched++
  }

  writeFileSync(ASSOCIATIONS_PATH, JSON.stringify(associations, null, 2) + '\n')
  console.log(
    `Annotated ${matched}/${associations.rows.length} rows with largestCds → ${ASSOCIATIONS_PATH}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

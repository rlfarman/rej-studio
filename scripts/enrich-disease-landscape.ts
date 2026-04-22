/**
 * Annotate src/features/disease-landscape/data/landscape.json with the
 * `largestCds` field — the max coding_sequence_length across each gene's
 * human isoforms. Queries whatever DB the Drizzle client is pointed at
 * (Neon in prod, PGlite locally if `data/isoforms.jsonl` has been loaded).
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/enrich-disease-landscape.ts
 *
 * Run this after every `pnpm db:upload` so landscape.json stays in sync
 * with the latest isoform seed.
 */

import { readFileSync, writeFileSync } from 'fs'
import { sql } from 'drizzle-orm'
import { getDb } from '../src/drizzle/db'
import { isoforms } from '../src/drizzle/schema'
import type { LandscapeData } from '../src/features/disease-landscape/types'

const LANDSCAPE_PATH = 'src/features/disease-landscape/data/landscape.json'

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

  const landscape = JSON.parse(
    readFileSync(LANDSCAPE_PATH, 'utf8'),
  ) as LandscapeData

  let matched = 0
  for (const row of landscape.rows) {
    const cds = row.ensemblGeneId
      ? (maxCdsByGeneId.get(row.ensemblGeneId) ?? null)
      : null
    row.largestCds = cds
    if (cds !== null) matched++
  }

  writeFileSync(LANDSCAPE_PATH, JSON.stringify(landscape, null, 2) + '\n')
  console.log(
    `Annotated ${matched}/${landscape.rows.length} rows with largestCds → ${LANDSCAPE_PATH}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

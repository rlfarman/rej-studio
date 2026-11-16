// @vitest-environment node
/**
 * Applies every committed migration to a fresh PGlite, loaded the way
 * src/drizzle/client.ts loads it (with the pg_trgm bundle), and checks the
 * search indexes exist and can serve the query shapes gene search uses.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'

let client: PGlite

beforeAll(async () => {
  client = new PGlite({ extensions: { pg_trgm } })
  await migrate(drizzle({ client }), {
    migrationsFolder: 'src/drizzle/migrations',
  })
})

async function indexNames(): Promise<string[]> {
  const { rows } = await client.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
  )
  return rows.map((r) => r.indexname)
}

async function plan(query: string): Promise<string> {
  // The tables are empty, so force the planner off sequential scans to see
  // whether an index can serve the predicate at all.
  await client.exec('SET enable_seqscan = off')
  const { rows } = await client.query<{ 'QUERY PLAN': string }>(
    `EXPLAIN ${query}`,
  )
  await client.exec('RESET enable_seqscan')
  return rows.map((r) => r['QUERY PLAN']).join('\n')
}

describe('migrations', () => {
  it('creates the trigram and case-insensitive symbol indexes', async () => {
    const names = await indexNames()
    expect(names).toEqual(
      expect.arrayContaining([
        'idx_genes_symbol_lower',
        'idx_genes_symbol_trgm',
        'idx_genes_name_trgm',
        'idx_genes_alternate_symbols_trgm',
        'idx_genes_search_vector',
        'idx_isoforms_gene_id',
      ]),
    )
  })

  it('drops the indexes no query used', async () => {
    const names = await indexNames()
    expect(names).not.toContain('idx_genes_name')
    expect(names).not.toContain('idx_isoforms_species')
    expect(names).not.toContain('idx_isoforms_cds_length')
  })

  it('serves an escaped substring LIKE from the trigram index', async () => {
    const explain = await plan(
      `SELECT id FROM genes WHERE lower(name) LIKE '%repair%' ESCAPE '\\'`,
    )
    expect(explain).toContain('idx_genes_name_trgm')
  })

  it('serves a case-insensitive symbol lookup from the lower() index', async () => {
    const explain = await plan(
      `SELECT id FROM genes WHERE lower(symbol) = 'tp53'`,
    )
    expect(explain).toMatch(/idx_genes_symbol_(lower|trgm)/)
  })
})

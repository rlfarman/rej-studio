/**
 * Side-by-side comparison of the old Postgres ts_rank+LIKE search and the new
 * MiniSearch index. Prints top-5 results for each fixture query under both
 * ranking systems and a verdict per query.
 *
 *   pnpm tsx --env-file=.env scripts/search-parity.ts
 *
 * Run after `pnpm content:emit` so the search index files exist on disk.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { sql, eq } from 'drizzle-orm'
import MiniSearch from 'minisearch'
import { getDb } from '../src/drizzle/db'
import { genes, isoforms } from '../src/drizzle/schema'
import {
  ENSG_REGEX,
  ENST_REGEX,
} from '../src/features/gene-search/utils/ensembl-regex'

const QUERIES = [
  'BRCA',
  'BRCA1',
  'BRCA2',
  'TP53',
  'p53',
  'MYC',
  'EGFR',
  'KRAS',
  'cystic',
  'cystic fibrosis',
  'breast cancer',
  'insulin',
  'hemoglobin',
  'TP5',
  'BRC',
  'apoe',
  'NM_007294',
  'CFTR',
  'collagen',
  'titin',
] as const

type Result = { id: string; symbol: string; name: string; species: string }

async function fetchPostgresResults(query: string): Promise<Result[]> {
  const db = await getDb()
  const trimmed = query.trim()
  if (ENST_REGEX.test(trimmed)) {
    const rows = await db
      .select({
        id: genes.id,
        symbol: genes.symbol,
        name: genes.name,
        species: genes.species,
      })
      .from(isoforms)
      .innerJoin(genes, eq(isoforms.geneId, genes.id))
      .where(eq(isoforms.id, trimmed))
      .limit(5)
    return rows
  }
  if (ENSG_REGEX.test(trimmed)) {
    const rows = await db
      .select({
        id: genes.id,
        symbol: genes.symbol,
        name: genes.name,
        species: genes.species,
      })
      .from(genes)
      .where(eq(genes.id, trimmed))
      .limit(5)
    return rows
  }
  const lower = trimmed.toLowerCase()
  const tsq = sql`plainto_tsquery('simple', ${trimmed})`
  const ftsMatch = sql`${genes.searchVector} @@ ${tsq}`
  const ftsRank = sql<number>`ts_rank(${genes.searchVector}, ${tsq})`
  const cont = `%${lower}%`
  const pre = `${lower}%`
  const symMatch = sql`LOWER(${genes.symbol}) LIKE ${cont}`
  const nameMatch = sql`LOWER(${genes.name}) LIKE ${cont}`
  const altMatch = sql`LOWER(${genes.alternateSymbols}) LIKE ${cont}`
  const likeRank = sql<number>`CASE
    WHEN LOWER(${genes.symbol}) = ${lower} THEN 0
    WHEN LOWER(${genes.symbol}) LIKE ${pre} THEN 1
    WHEN LOWER(${genes.name}) LIKE ${pre} THEN 2
    WHEN LOWER(${genes.symbol}) LIKE ${cont}  THEN 3
    WHEN LOWER(${genes.name}) LIKE ${cont} THEN 4
    ELSE 5 END`
  const rows = await db
    .select({
      id: genes.id,
      symbol: genes.symbol,
      name: genes.name,
      species: genes.species,
    })
    .from(genes)
    .where(sql`${ftsMatch} OR ${symMatch} OR ${nameMatch} OR ${altMatch}`)
    .orderBy(sql`${ftsRank} DESC`, likeRank, genes.name)
    .limit(5)
  return rows
}

function loadShard(species: string): MiniSearch<any> {
  const raw = readFileSync(
    join(process.cwd(), 'public', 'data', `search-index-${species}.json`),
    'utf8',
  )
  return MiniSearch.loadJSON<any>(raw, {
    fields: ['symbol', 'name', 'alternateSymbols'],
    storeFields: ['geneId', 'symbol', 'name', 'species'],
    tokenize: (text: string) =>
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter(Boolean),
    searchOptions: {
      boost: { symbol: 5, alternateSymbols: 3, name: 1 },
      prefix: true,
      fuzzy: 0.2,
    },
  })
}

function searchMini(shards: MiniSearch<any>[], query: string): Result[] {
  const trimmed = query.trim()
  const lower = trimmed.toLowerCase()
  const hits = shards.flatMap((m) => m.search(trimmed, { combineWith: 'AND' }))
  const reranked = hits.map((h: any) => {
    const symLower = String(h.symbol).toLowerCase()
    let bonus = 0
    if (symLower === lower) bonus = 1000
    else if (symLower.startsWith(lower)) bonus = 200
    else if (symLower.includes(lower)) bonus = 50
    return { ...h, score: h.score + bonus }
  })
  reranked.sort(
    (a: any, b: any) =>
      b.score - a.score || String(a.symbol).localeCompare(String(b.symbol)),
  )
  const seen = new Set<string>()
  const out: Result[] = []
  for (const r of reranked as any[]) {
    if (seen.has(r.geneId)) continue
    seen.add(r.geneId)
    out.push({
      id: r.geneId,
      symbol: r.symbol,
      name: r.name,
      species: r.species,
    })
    if (out.length >= 5) break
  }
  return out
}

function fmt(rows: Result[]): string {
  if (rows.length === 0) return '  (no results)'
  return rows
    .map(
      (r, i) =>
        `  ${i + 1}. ${r.symbol.padEnd(12)} ${r.species.padEnd(6)} ${r.name}`,
    )
    .join('\n')
}

async function main() {
  console.log('Loading MiniSearch shards…')
  const shards = ['human', 'mouse'].map(loadShard)
  let mismatches = 0
  for (const q of QUERIES) {
    console.log(`\n=== "${q}" ===`)
    const [pg, mini] = await Promise.all([
      fetchPostgresResults(q),
      Promise.resolve(searchMini(shards, q)),
    ])
    console.log('PG:')
    console.log(fmt(pg))
    console.log('MiniSearch:')
    console.log(fmt(mini))
    const pgSet = new Set(pg.slice(0, 5).map((r) => r.id))
    const miniSet = new Set(mini.slice(0, 5).map((r) => r.id))
    const overlap = [...pgSet].filter((x) => miniSet.has(x)).length
    const verdict = overlap >= Math.min(3, pgSet.size) ? 'OK' : 'CHECK'
    if (verdict !== 'OK') mismatches++
    console.log(
      `Overlap top-5: ${overlap}/${Math.max(pgSet.size, miniSet.size)} — ${verdict}`,
    )
  }
  console.log(`\nDone. Queries needing review: ${mismatches}/${QUERIES.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

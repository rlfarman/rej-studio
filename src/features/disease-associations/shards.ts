import type { AssociationData, AssociationRow } from './types'

/**
 * A gene page needs one row of the disease-associations table, so the build
 * also splits the table into small files by symbol prefix
 * (`associationShards` in vite.config.ts) and the page fetches only its own.
 * The explorer still reads the whole table.
 *
 * This module is shared by the build (Node) and the browser, so it imports
 * nothing but types.
 */

/** What the client is told about the shards at build time. */
export type AssociationShardManifest = {
  /**
   * Where the shards are served, ending in a directory named for their
   * content, so a file there never changes and can be cached for good.
   */
  base: string
  /** The prefixes that have a file; any other symbol has no row. */
  keys: string[]
}

/**
 * A symbol's shard: its first two characters, lowercased, anything outside
 * [a-z0-9] as `_`. The same scheme as the gene corpus's symbol shards
 * (`symbolShardKey` in gene-search/corpus/format.ts), restated here because
 * a feature may not import another. 599 genes make about 200 files of at
 * most 20 rows.
 */
export function associationShardKey(symbol: string): string {
  return symbol
    .toLowerCase()
    .slice(0, 2)
    .replace(/[^a-z0-9]/g, '_')
}

export function associationShardUrl(base: string, key: string): string {
  return `${base}/${key}.json`
}

/** The table's rows grouped by shard key, each file an AssociationData. */
export function buildAssociationShards(
  data: AssociationData,
): Map<string, AssociationData> {
  const shards = new Map<string, AssociationData>()
  for (const row of data.rows) {
    const key = associationShardKey(row.symbol)
    let shard = shards.get(key)
    if (!shard) {
      shard = { rows: [] }
      shards.set(key, shard)
    }
    shard.rows.push(row)
  }
  return shards
}

function findBySymbol(
  rows: AssociationRow[],
  symbol: string,
): AssociationRow | undefined {
  const q = symbol.toUpperCase()
  return rows.find((r) => r.symbol.toUpperCase() === q)
}

/**
 * One gene's row, from its shard: null when the gene has none, without a
 * request when no symbol shares its prefix.
 */
export async function fetchAssociation(
  symbol: string,
  manifest: AssociationShardManifest,
  fetchFn: typeof fetch = fetch,
): Promise<AssociationRow | null> {
  const key = associationShardKey(symbol)
  if (!manifest.keys.includes(key)) return null
  const response = await fetchFn(associationShardUrl(manifest.base, key))
  if (!response.ok) {
    throw new Error(`Disease associations (${key}): HTTP ${response.status}`)
  }
  const { rows } = (await response.json()) as AssociationData
  return findBySymbol(rows, symbol) ?? null
}

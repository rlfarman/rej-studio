/**
 * Alternate gene symbols are stored as a pipe-delimited string with sentinels:
 *   "|Abca1|Cerp|Tgd|"
 *
 * The sentinel pipes let us search with a plain `LOWER(col) LIKE '%query%'`
 * pattern that works in any SQL dialect (no Postgres arrays, no SQLite
 * json_each). The original casing is preserved for display.
 */

export function parseAlternateSymbols(
  value: string | null | undefined,
): string[] {
  if (!value) return []
  return value.split('|').filter((s) => s.length > 0)
}

export function serializeAlternateSymbols(symbols: readonly string[]): string {
  if (symbols.length === 0) return ''
  return `|${symbols.join('|')}|`
}

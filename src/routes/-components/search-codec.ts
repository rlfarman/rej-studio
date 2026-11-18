/*
 * The router's search-param codec: plain query strings, as people type and
 * share them. TanStack Router's default writes every non-plain value as
 * JSON (`?q=53` came back as `?q=%2253%22`) and parses numbers into
 * numbers; here every value stays text and the routes' zod schemas
 * (search-params.ts) coerce what they need.
 *
 *   parse:     ?q=53&i=X-linked&i=Y-linked → { q: '53', i: ['X-linked', 'Y-linked'] }
 *   stringify: { q: '53', i: ['a', 'b'] }   → ?q=53&i=a&i=b
 */

type SearchValue = string | string[]

/**
 * Links copied while the app used the router's JSON codec carry JSON
 * values: `?q=%2253%22` (a quoted string) or `?i=%5B%22X-linked%22%5D`
 * (an array). Those are read back as what they meant; anything else that
 * merely looks like JSON stays the text it is.
 */
function fromLegacyJson(value: string): SearchValue {
  const quoted =
    value.length >= 2 && value.startsWith('"') && value.endsWith('"')
  if (!quoted && !value.startsWith('[')) return value
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed === 'string') return parsed
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed
    }
  } catch {
    // Not JSON after all: keep the text.
  }
  return value
}

/** A query string (with or without `?`) as text values; repeats become arrays. */
export function parseSearch(searchStr: string): Record<string, SearchValue> {
  const result: Record<string, SearchValue> = Object.create(null)
  for (const [key, raw] of new URLSearchParams(searchStr)) {
    const value = fromLegacyJson(raw)
    const previous = result[key]
    result[key] = previous === undefined ? value : [previous, value].flat()
  }
  return result
}

/**
 * Search params as a query string (with its `?`, or '' when empty). Arrays
 * repeat the key; undefined and null drop it; other values are written as
 * text. A nested object has no plain form, so it is written as JSON.
 */
export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null) continue
      params.append(
        key,
        typeof item === 'object' ? JSON.stringify(item) : String(item),
      )
    }
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

import { ENSG_REGEX } from './ensembl-regex'

export type MatchedField =
  | { kind: 'transcript'; id: string }
  | { kind: 'geneId' }
  | { kind: 'symbol' }
  | { kind: 'name' }
  | { kind: 'alias' }

/**
 * Which field a search result most likely matched on, so a result row can
 * say why it's there. Search ranks with full-text search plus substring
 * matches over symbol, name, and alternate symbols; anything not visibly in
 * the symbol or name matched an alias or a full-text term.
 */
export function matchedField(
  gene: { symbol: string; name: string; matchedIsoformId?: string },
  query: string,
): MatchedField {
  const trimmed = query.trim()
  const q = trimmed.toLowerCase()
  if (gene.matchedIsoformId) {
    return { kind: 'transcript', id: gene.matchedIsoformId }
  }
  if (ENSG_REGEX.test(trimmed)) return { kind: 'geneId' }
  if (gene.symbol.toLowerCase().includes(q)) return { kind: 'symbol' }
  if (gene.name.toLowerCase().includes(q)) return { kind: 'name' }
  return { kind: 'alias' }
}

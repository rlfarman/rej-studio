import { ENSG_REGEX } from './ensembl-regex'

export type MatchedField =
  | { kind: 'transcript'; id: string }
  | { kind: 'geneId' }
  | { kind: 'symbol' }
  | { kind: 'name' }
  | { kind: 'alias' }

/**
 * Which field a search result most likely matched on, so a result row can
 * say why it's there. Search matches words and prefixes of the symbol, name
 * and alternate symbols (and, failing that, close spellings); anything not
 * visibly in the symbol or name matched an alias or a close spelling.
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

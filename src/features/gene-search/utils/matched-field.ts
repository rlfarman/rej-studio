import { geneSearchCopy } from '../copy'
import type { GeneSearchResult } from '../types/search'
import { ENSG_REGEX } from './ensembl-regex'

const copy = geneSearchCopy.results.matched

export type MatchedField =
  | { kind: 'transcript'; id: string }
  | { kind: 'geneId' }
  | { kind: 'symbol'; typo?: boolean }
  | { kind: 'name'; typo?: boolean }
  | { kind: 'alias'; typo?: boolean }

/**
 * Which field a search result matched on, so a result row can say why it's
 * there. Text search reports it (`gene.match`); for results without it, the
 * field is inferred from what is visibly in the symbol or name.
 */
export function matchedField(
  gene: Pick<
    GeneSearchResult,
    'symbol' | 'name' | 'matchedIsoformId' | 'match'
  >,
  query: string,
): MatchedField {
  const trimmed = query.trim()
  const q = trimmed.toLowerCase()
  if (gene.matchedIsoformId) {
    return { kind: 'transcript', id: gene.matchedIsoformId }
  }
  if (ENSG_REGEX.test(trimmed)) return { kind: 'geneId' }
  if (gene.match) return { kind: gene.match.field, typo: gene.match.typo }
  if (gene.symbol.toLowerCase().includes(q)) return { kind: 'symbol' }
  if (gene.name.toLowerCase().includes(q)) return { kind: 'name' }
  return { kind: 'alias' }
}

/**
 * The one-line reason a row is in the results, as both the /genes list and
 * the palette say it — a gene that matched on an alias or a close spelling
 * looks arbitrary without it.
 */
export function matchedLabel(match: MatchedField): string {
  switch (match.kind) {
    case 'transcript':
      return copy.transcript(match.id)
    case 'geneId':
      return copy.geneId
    case 'symbol':
      return match.typo ? copy.closeSymbol : copy.symbol
    case 'name':
      return match.typo ? copy.closeName : copy.name
    case 'alias':
      return match.typo ? copy.closeAlias : copy.alias
  }
}

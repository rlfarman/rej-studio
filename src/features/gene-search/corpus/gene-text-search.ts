import MiniSearch, { type SearchOptions, type SearchResult } from 'minisearch'

import type { GeneSearchPage, SimilarGene } from '../types/search'
import { compareText, toResult, type IndexedGene } from './search-index'

/** What MiniSearch indexes: the gene's position in `genes`, and its text. */
interface SearchDocument {
  i: number
  symbol: string
  aliases: string
  name: string
}

/**
 * Field boosts: a hit in the symbol beats one in an alternate symbol, which
 * beats one in the name. The tiers (`tierOf`) decide the head of the list;
 * these order everything after it.
 */
const BOOST = { symbol: 4, aliases: 2, name: 1 } as const
const FIELDS = Object.keys(BOOST)

/** A field's place in BOOST: 0 for the symbol, the most telling. */
function fieldRank(field: string): number {
  return FIELDS.indexOf(field)
}

/** An adjacent swap's cost in `editDistance`; see there. */
const SWAP_COST = 0.5

/** Query terms shorter than this are never matched fuzzily (too noisy). */
const MIN_FUZZY_LENGTH = 4

/**
 * Edit distance for ranking typo matches: optimal string alignment
 * (Levenshtein plus adjacent swaps), with a swap costing half an edit.
 * MiniSearch's fuzzy match is plain Levenshtein, where a swap (`tp35` for
 * `tp53`) costs two edits; here it costs less than any wrong, missing or
 * extra letter, because it is the commonest typo and the letters typed are
 * the right ones. So `brac1` ranks BRCA1 above BRAT1 and RAC1.
 */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const d = new Float64Array(rows * cols)
  for (let i = 0; i < rows; i++) d[i * cols] = i
  for (let j = 0; j < cols; j++) d[j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min(
        d[(i - 1) * cols + j] + 1,
        d[i * cols + j - 1] + 1,
        d[(i - 1) * cols + j - 1] + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[(i - 2) * cols + j - 2] + SWAP_COST)
      }
      d[i * cols + j] = best
    }
  }
  return d[rows * cols - 1]
}

/**
 * How far a typo search reaches: two edits, so a swap (two in Levenshtein
 * terms) is found, and none for short terms, where two edits match
 * almost anything.
 */
function typoDistance(term: string): number | false {
  return term.length >= MIN_FUZZY_LENGTH ? 2 : false
}

/**
 * Where a gene ranks for the whole query, before relevance: its exact
 * symbol, then an exact alternate symbol, then symbols and alternate symbols
 * that start with the query, then a name that is the query (`insulin
 * receptor` is INSR's whole name); everything else (name words, partial and
 * typo matches) comes after, by score.
 */
const Tier = {
  ExactSymbol: 0,
  ExactAlias: 1,
  SymbolPrefix: 2,
  AliasPrefix: 3,
  ExactName: 4,
  Other: 5,
} as const
type Tier = (typeof Tier)[keyof typeof Tier]

function tierOf(gene: IndexedGene, lowerQuery: string): Tier {
  if (gene.lowerSymbol === lowerQuery) return Tier.ExactSymbol
  // Alternate symbols are `|A|B|`, so a pipe on each side is a whole one.
  if (gene.lowerAlternateSymbols.includes(`|${lowerQuery}|`)) {
    return Tier.ExactAlias
  }
  if (gene.lowerSymbol.startsWith(lowerQuery)) return Tier.SymbolPrefix
  if (gene.lowerAlternateSymbols.includes(`|${lowerQuery}`)) {
    return Tier.AliasPrefix
  }
  if (gene.name.toLowerCase() === lowerQuery) return Tier.ExactName
  return Tier.Other
}

interface Ranked {
  gene: IndexedGene
  tier: Tier
  /**
   * For a typo match: the summed edit distance of the query terms to their
   * closest matches, and which fields those matches were in (0 symbol,
   * 1 alternate symbol, 2 name), so `brac1` puts BRCA1 itself before the
   * genes whose names mention it. Zero for a literal match.
   */
  distance: number
  field: number
  score: number
}

function compareRanked(a: Ranked, b: Ranked): number {
  return (
    a.tier - b.tier ||
    a.distance - b.distance ||
    a.field - b.field ||
    // A shorter symbol is the closer prefix match (BRCA1 before BRCA1P1);
    // past the prefix tiers, length means nothing and score decides.
    (a.tier <= Tier.AliasPrefix
      ? a.gene.symbol.length - b.gene.symbol.length
      : b.score - a.score) ||
    compareText(a.gene.symbol, b.gene.symbol) ||
    compareText(a.gene.species, b.gene.species) ||
    compareText(a.gene.id, b.gene.id)
  )
}

/**
 * Gene text search: MiniSearch over the symbol, alternate symbols and name of
 * every gene in a `GeneSearchIndex`, ranked for genes (see `rank`).
 */
export class GeneTextSearch {
  private readonly miniSearch: MiniSearch<SearchDocument>

  /**
   * Builds the index: for the full corpus (~40,000 genes), ~0.4 s and
   * ~80 MB of heap in Node, most of it MiniSearch's per-term maps (the
   * ~45,000 distinct alternate symbols alone are ~40 MB). The Worker pays
   * the same, only in an isolate that serves MCP `search_genes`.
   */
  constructor(private readonly genes: readonly IndexedGene[]) {
    this.miniSearch = new MiniSearch<SearchDocument>({
      idField: 'i',
      fields: FIELDS,
      // The default tokenizer (words split at spaces and punctuation, so
      // `HLA-A` is `hla` and `a`) and lowercasing. A hyphenated symbol typed
      // whole still ranks first: the tiers compare the whole query.
      searchOptions: { boost: BOOST },
    })
    this.miniSearch.addAll(
      genes.map((gene, i) => ({
        i,
        symbol: gene.symbol,
        // The default tokenizer splits at punctuation, which `|` is not.
        aliases: gene.alternateSymbols.replaceAll('|', ' '),
        name: gene.name,
      })),
    )
  }

  /**
   * MiniSearch, then the gene-specific ranking. Every term must match (AND).
   * A literal pass (whole words and prefixes) answers almost every query;
   * only when it finds nothing does a typo pass run, matching terms of four
   * or more characters within two edits. Keeping typos out of the first pass
   * stops `tp53` from pulling in every four-letter symbol two edits away,
   * while `tp35` and `brac1`, which match nothing literally, still find TP53
   * and BRCA1.
   */
  private rank(
    query: string,
    species: string,
    options: Pick<SearchOptions, 'fields'> = {},
  ): Ranked[] {
    const lowerQuery = query.trim().toLowerCase()
    const filter =
      species === 'both'
        ? undefined
        : (result: SearchResult) =>
            this.genes[result.id as number].species === species
    const base: SearchOptions = { ...options, combineWith: 'AND', filter }

    let typo = false
    let hits = this.miniSearch.search(query, { ...base, prefix: true })
    if (hits.length === 0) {
      typo = true
      hits = this.miniSearch.search(query, { ...base, fuzzy: typoDistance })
    }
    return hits.map((hit) => {
      const gene = this.genes[hit.id as number]
      let distance = 0
      let field = 0
      for (const term of typo ? hit.queryTerms : []) {
        let best = { distance: Infinity, field: 0 }
        for (const matched of hit.terms) {
          const candidate = {
            distance: editDistance(term, matched),
            field: Math.min(...hit.match[matched].map(fieldRank)),
          }
          if (
            candidate.distance < best.distance ||
            (candidate.distance === best.distance &&
              candidate.field < best.field)
          ) {
            best = candidate
          }
        }
        distance += best.distance
        field += best.field
      }
      return {
        gene,
        tier: tierOf(gene, lowerQuery),
        distance,
        field,
        score: hit.score,
      }
    })
  }

  /** Ranked text search; `truncated` when more than `limit` genes matched. */
  search(query: string, species: string, limit: number): GeneSearchPage {
    const ranked = this.rank(query, species).sort(compareRanked)
    return {
      results: ranked.slice(0, limit).map(({ gene }) => toResult(gene)),
      truncated: ranked.length > limit,
    }
  }

  /**
   * "Did you mean" for a symbol with no gene: the same search, over symbols
   * and alternate symbols only, so a typo (`tp35`) suggests the gene it
   * meant (TP53). Up to five, one per symbol and species.
   */
  similarGenes(lowerSymbol: string): SimilarGene[] {
    const ranked = this.rank(lowerSymbol, 'both', {
      fields: ['symbol', 'aliases'],
    }).sort(compareRanked)
    const seen = new Set<string>()
    const similar: SimilarGene[] = []
    for (const { gene } of ranked) {
      const key = `${gene.symbol}/${gene.species}`
      if (seen.has(key)) continue
      seen.add(key)
      similar.push({ symbol: gene.symbol, species: gene.species })
      if (similar.length === 5) break
    }
    return similar
  }
}

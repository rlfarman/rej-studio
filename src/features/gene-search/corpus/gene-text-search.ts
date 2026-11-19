import MiniSearch from 'minisearch'

import type {
  GeneSearchPage,
  GeneSearchResult,
  SimilarGene,
} from '../types/search'
import { compareText, toResult, type IndexedGene } from './search-index'

/*
 * Gene text search, in two parts, because memory decides the split.
 *
 * Symbols and alternate symbols are matched by scanning the gene table:
 * exact and prefix matches of the whole query, and (in the typo pass) an
 * edit-distance scan. Names go to MiniSearch, one document per distinct
 * name, for word and prefix matching, BM25 relevance and fuzzy matching.
 *
 * MiniSearch keeps a few maps per distinct term, so its memory follows the
 * term count. The ~45,000 distinct alternate symbols and ~24,000 symbols
 * are nearly all one-off terms: indexing them as well took the full corpus
 * from ~33 MB to ~97 MB of heap, too much beside an inline design in a
 * 128 MB Worker isolate. A scan over 40,000 rows answers them in a few
 * milliseconds instead.
 */

/** One distinct name (lowercased), as MiniSearch indexes it. */
interface NameDocument {
  i: number
  name: string
}

/** Which field a match was in, best first: the ranking's tiebreak. */
const Field = { Symbol: 0, Alias: 1, Name: 2 } as const

/** An adjacent swap's cost in `editDistance`; see there. */
const SWAP_COST = 0.5

/** Query terms shorter than this are never matched fuzzily (too noisy). */
const MIN_FUZZY_LENGTH = 4

/** The furthest a typo match may be (two edits; a swap is half of one). */
const MAX_TYPO_DISTANCE = 2

/**
 * Edit distance for ranking typo matches: optimal string alignment
 * (Levenshtein plus adjacent swaps), with a swap costing half an edit.
 * In plain Levenshtein (MiniSearch's fuzzy match) a swap (`tp35` for
 * `tp53`) costs two edits; here it costs less than any wrong, missing or
 * extra letter, because it is the commonest typo and the letters typed are
 * the right ones. So `brac1` ranks BRCA1 above BRAT1 and RAC1.
 */
export function editDistance(a: string, b: string): number {
  return distanceWithin(a, b, 0, b.length, Infinity)
}

// Three rolling rows of the distance table (a swap looks two rows back),
// reused across calls: the typo scan runs this ~200,000 times per query.
let rows = [new Float64Array(32), new Float64Array(32), new Float64Array(32)]

/**
 * `editDistance` of `a` to `b.slice(start, end)`, without slicing, or
 * Infinity as soon as it must exceed `max` (or, cheaper still, when the
 * lengths alone say so).
 */
function distanceWithin(
  a: string,
  b: string,
  start: number,
  end: number,
  max: number,
): number {
  const n = end - start
  if (Math.abs(a.length - n) > max) return Infinity
  if (rows[0].length <= n) {
    rows = rows.map(() => new Float64Array(n + 1))
  }
  let [twoBack, prev, row] = rows
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    row[0] = i
    let rowMin = i
    for (let j = 1; j <= n; j++) {
      const bj = b.charCodeAt(start + j - 1)
      const ai = a.charCodeAt(i - 1)
      let best = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (ai === bj ? 0 : 1),
      )
      if (
        i > 1 &&
        j > 1 &&
        ai === b.charCodeAt(start + j - 2) &&
        a.charCodeAt(i - 2) === bj
      ) {
        best = Math.min(best, twoBack[j - 2] + SWAP_COST)
      }
      row[j] = best
      if (best < rowMin) rowMin = best
    }
    if (rowMin > max) return Infinity
    ;[twoBack, prev, row] = [prev, row, twoBack]
  }
  return prev[n] <= max ? prev[n] : Infinity
}

/**
 * How far MiniSearch's fuzzy name search reaches: two Levenshtein edits, so
 * a swap (two there) is found, and none for short terms, where two edits
 * match almost anything.
 */
function typoDistance(term: string): number | false {
  return term.length >= MIN_FUZZY_LENGTH ? MAX_TYPO_DISTANCE : false
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

/** The symbol and alternate-symbol tiers, or null when neither matches. */
function symbolTier(gene: IndexedGene, lowerQuery: string): Tier | null {
  if (gene.lowerSymbol === lowerQuery) return Tier.ExactSymbol
  // Alternate symbols are `|A|B|`, so a pipe on each side is a whole one.
  if (gene.lowerAlternateSymbols.includes(`|${lowerQuery}|`)) {
    return Tier.ExactAlias
  }
  if (gene.lowerSymbol.startsWith(lowerQuery)) return Tier.SymbolPrefix
  if (gene.lowerAlternateSymbols.includes(`|${lowerQuery}`)) {
    return Tier.AliasPrefix
  }
  return null
}

interface Ranked {
  gene: IndexedGene
  tier: Tier
  /**
   * For a typo match: the edit distance of the query to its closest match,
   * and which field that was in (`Field`), so `brac1` puts BRCA1 itself
   * before the genes whose names mention it. Zero for a literal match.
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

const FIELD_NAMES = ['symbol', 'alias', 'name'] as const

/** Which field a ranked gene matched on, and whether only by a typo. */
function matchOf(ranked: Ranked): NonNullable<GeneSearchResult['match']> {
  if (ranked.distance > 0) {
    return { field: FIELD_NAMES[ranked.field], typo: true }
  }
  switch (ranked.tier) {
    case Tier.ExactSymbol:
    case Tier.SymbolPrefix:
      return { field: 'symbol', typo: false }
    case Tier.ExactAlias:
    case Tier.AliasPrefix:
      return { field: 'alias', typo: false }
    default:
      return { field: 'name', typo: false }
  }
}

/** The better of two rankings of the same gene. */
function better(a: Ranked | undefined, b: Ranked): Ranked {
  return a && compareRanked(a, b) <= 0 ? a : b
}

/**
 * Gene text search over a `GeneSearchIndex`'s genes, ranked for genes: see
 * the note at the top of this file and `rank`.
 */
export class GeneTextSearch {
  /** MiniSearch over the distinct names. */
  private readonly names: MiniSearch<NameDocument>
  /**
   * The genes (indexes into `genes`) of distinct name `i` are
   * `nameGenes[nameStart[i]]` up to `nameGenes[nameStart[i + 1]]`: flat
   * typed arrays rather than ~30,000 small ones.
   */
  private readonly nameStart: Int32Array
  private readonly nameGenes: Int32Array

  /**
   * Builds the name index: for the full corpus (~40,000 genes, ~30,700
   * distinct names), ~0.2 s and ~20 MB of heap in Node, on top of the
   * ~13.5 MB gene table. The browser builds it in the search worker's idle
   * time; the Worker only in an isolate that serves MCP `search_genes`.
   */
  constructor(private readonly genes: readonly IndexedGene[]) {
    const byName = new Map<string, number>()
    const documents: NameDocument[] = []
    const nameOf = genes.map((gene) => {
      const name = gene.name.toLowerCase()
      let i = byName.get(name)
      if (i === undefined) {
        i = documents.length
        byName.set(name, i)
        documents.push({ i, name })
      }
      return i
    })
    // Counting sort of gene indexes by name.
    this.nameStart = new Int32Array(documents.length + 1)
    for (const i of nameOf) this.nameStart[i + 1]++
    for (let i = 0; i < documents.length; i++) {
      this.nameStart[i + 1] += this.nameStart[i]
    }
    this.nameGenes = new Int32Array(genes.length)
    const next = this.nameStart.slice(0, documents.length)
    nameOf.forEach((i, g) => {
      this.nameGenes[next[i]++] = g
    })
    // The default tokenizer: words split at spaces and punctuation.
    this.names = new MiniSearch<NameDocument>({
      idField: 'i',
      fields: ['name'],
    })
    this.names.addAll(documents)
  }

  /** The genes whose name is distinct name `i`. */
  private genesNamed(i: number): Int32Array {
    return this.nameGenes.subarray(this.nameStart[i], this.nameStart[i + 1])
  }

  /**
   * Every gene the query matches, ranked but unsorted. A literal pass
   * (symbol and alternate-symbol exact or prefix matches of the whole
   * query; name matches where every word matches, as a word or prefix)
   * answers almost every query. Only when it finds nothing does a typo pass
   * run: symbols and alternate symbols within two edits of a one-word query
   * of four or more characters, and names whose words are within two edits.
   * Keeping typos out of the first pass stops `tp53` from pulling in every
   * four-letter symbol two edits away, while `tp35` and `brac1`, which match
   * nothing literally, still find TP53 and BRCA1.
   */
  private rank(
    query: string,
    species: string,
    { names }: { names: boolean },
  ): Ranked[] {
    const lowerQuery = query.trim().toLowerCase()
    const matches = new Map<number, Ranked>()
    const add = (g: number, ranked: Omit<Ranked, 'gene'>) => {
      const gene = this.genes[g]
      if (species !== 'both' && gene.species !== species) return
      matches.set(g, better(matches.get(g), { gene, ...ranked }))
    }

    this.genes.forEach((gene, g) => {
      const tier = symbolTier(gene, lowerQuery)
      if (tier !== null) add(g, { tier, distance: 0, field: 0, score: 0 })
    })
    if (names) {
      for (const hit of this.names.search(lowerQuery, {
        prefix: true,
        combineWith: 'AND',
      })) {
        for (const g of this.genesNamed(hit.id as number)) {
          const gene = this.genes[g]
          add(g, {
            tier:
              symbolTier(gene, lowerQuery) ??
              (gene.name.toLowerCase() === lowerQuery
                ? Tier.ExactName
                : Tier.Other),
            distance: 0,
            field: 0,
            score: hit.score,
          })
        }
      }
    }
    if (matches.size === 0) this.typoMatches(lowerQuery, names, add)
    return [...matches.values()]
  }

  /** The typo pass of `rank`. */
  private typoMatches(
    lowerQuery: string,
    names: boolean,
    add: (g: number, ranked: Omit<Ranked, 'gene'>) => void,
  ) {
    if (lowerQuery.length >= MIN_FUZZY_LENGTH && !/\s/.test(lowerQuery)) {
      this.genes.forEach((gene, g) => {
        const symbol = gene.lowerSymbol
        let distance = distanceWithin(
          lowerQuery,
          symbol,
          0,
          symbol.length,
          MAX_TYPO_DISTANCE,
        )
        let field: number = Field.Symbol
        // Each alternate symbol in `|A|B|`, read in place.
        const aliases = gene.lowerAlternateSymbols
        for (let from = 1; from < aliases.length;) {
          const to = aliases.indexOf('|', from)
          const d = distanceWithin(
            lowerQuery,
            aliases,
            from,
            to,
            MAX_TYPO_DISTANCE,
          )
          if (d < distance) {
            distance = d
            field = Field.Alias
          }
          from = to + 1
        }
        if (distance <= MAX_TYPO_DISTANCE) {
          add(g, { tier: Tier.Other, distance, field, score: 0 })
        }
      })
    }
    if (!names) return
    for (const hit of this.names.search(lowerQuery, {
      fuzzy: typoDistance,
      combineWith: 'AND',
    })) {
      // Each query word's distance to the closest name word it matched.
      let distance = 0
      for (const term of hit.queryTerms) {
        distance += Math.min(
          ...hit.terms.map((matched) => editDistance(term, matched)),
        )
      }
      for (const g of this.genesNamed(hit.id as number)) {
        add(g, {
          tier: Tier.Other,
          distance,
          field: Field.Name,
          score: hit.score,
        })
      }
    }
  }

  /**
   * Ranked text search; `truncated` when more than `limit` genes matched,
   * and `total` however many did. Ranking already walks every match, so the
   * total is a length, not a second search.
   */
  search(query: string, species: string, limit: number): GeneSearchPage {
    const ranked = this.rank(query, species, { names: true }).sort(
      compareRanked,
    )
    return {
      results: ranked
        .slice(0, limit)
        .map((r) => ({ ...toResult(r.gene), match: matchOf(r) })),
      truncated: ranked.length > limit,
      total: ranked.length,
    }
  }

  /**
   * "Did you mean" for a symbol with no gene: the same search, over symbols
   * and alternate symbols only, so a typo (`tp35`) suggests the gene it
   * meant (TP53). Up to five, one per symbol and species.
   */
  similarGenes(lowerSymbol: string): SimilarGene[] {
    const ranked = this.rank(lowerSymbol, 'both', { names: false }).sort(
      compareRanked,
    )
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

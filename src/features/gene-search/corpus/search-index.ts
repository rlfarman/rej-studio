import type {
  GeneSearchPage,
  GeneSearchResult,
  SimilarGene,
} from '../types/search'
import type { GeneIndexFile, GeneTable } from './format'
import {
  RANK_FLOOR,
  geneVector,
  lexemes,
  tsRank,
  type TsVector,
} from './text-search'

interface IndexedGene {
  id: string
  symbol: string
  name: string
  species: string
  alternateSymbols: string
  lowerSymbol: string
  lowerName: string
  lowerAlternateSymbols: string
}

/** Code-unit order: what Postgres's C collation gives for this ASCII data. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function toResult(gene: IndexedGene): GeneSearchResult {
  return {
    id: gene.id,
    name: gene.name,
    symbol: gene.symbol,
    species: gene.species,
  }
}

/**
 * The gene index in memory, answering the same questions as the Postgres
 * queries in api/gene-queries.ts, with the same ordering. Each method names
 * the query it mirrors; read them side by side when changing either.
 */
export class GeneSearchIndex {
  readonly version: string
  readonly transcriptShards: number
  private readonly genes: IndexedGene[]
  private readonly byId: Map<string, IndexedGene>
  /** Lexeme → indexes of the genes whose vector holds it, ascending. */
  private postings: Map<string, Int32Array> | null = null
  private readonly vectors = new Map<number, TsVector>()

  /**
   * From the whole index, or from one symbol shard (then only the lookups
   * the shard can answer are meaningful, and there are no transcripts).
   */
  constructor(file: GeneIndexFile | GeneTable) {
    this.version = file.version
    this.transcriptShards =
      'transcriptShards' in file ? file.transcriptShards : 0
    const { id, symbol, name, species, alternateSymbols } = file.genes
    this.genes = id.map((geneId, i) => ({
      id: geneId,
      symbol: symbol[i],
      name: name[i],
      species: file.species[species[i]],
      alternateSymbols: alternateSymbols[i],
      lowerSymbol: symbol[i].toLowerCase(),
      lowerName: name[i].toLowerCase(),
      lowerAlternateSymbols: alternateSymbols[i].toLowerCase(),
    }))
    this.byId = new Map(this.genes.map((gene) => [gene.id, gene]))
  }

  private vector(i: number): TsVector {
    let vector = this.vectors.get(i)
    if (!vector) {
      const gene = this.genes[i]
      vector = geneVector(gene.symbol, gene.name, gene.alternateSymbols)
      this.vectors.set(i, vector)
    }
    return vector
  }

  /** Built on the first full-text search rather than at load. */
  private getPostings(): Map<string, Int32Array> {
    if (this.postings) return this.postings
    const lists = new Map<string, number[]>()
    this.genes.forEach((gene, i) => {
      for (const lexeme of geneVector(
        gene.symbol,
        gene.name,
        gene.alternateSymbols,
      ).keys()) {
        const list = lists.get(lexeme)
        if (list) list.push(i)
        else lists.set(lexeme, [i])
      }
    })
    this.postings = new Map(
      [...lists].map(([lexeme, list]) => [lexeme, Int32Array.from(list)]),
    )
    return this.postings
  }

  /** A gene by exact Ensembl id. */
  gene(id: string): GeneSearchResult | null {
    const gene = this.byId.get(id)
    return gene ? toResult(gene) : null
  }

  /**
   * fetchGenesBySearch's text branch:
   *
   *   WHERE (vector @@ plainto_tsquery(q) OR lower(symbol|name|aliases)
   *          LIKE '%q%') AND species = ?
   *   ORDER BY lower(symbol) = q DESC, ts_rank DESC, <prefix/substring
   *            tier>, name, id
   *   LIMIT limit + 1
   */
  searchText(query: string, species: string, limit: number): GeneSearchPage {
    const lowerQuery = query.toLowerCase()
    const terms = lexemes(query)
    const unique = [...new Set(terms)]
    const postings = unique.length > 0 ? this.getPostings() : null

    // How many distinct query lexemes each gene holds. A gene holding all of
    // them matches the full-text branch; the count also says whether its
    // rank needs computing (see rankOf).
    const termHits = new Map<number, number>()
    for (const term of unique) {
      for (const i of postings?.get(term) ?? []) {
        termHits.set(i, (termHits.get(i) ?? 0) + 1)
      }
    }

    // Most genes hold too few of the query's lexemes for ts_rank to score
    // them: none of a one-lexeme query scores 0, and fewer than two of a
    // longer one leaves calc_rank_and at its 1e-20 floor. Only build the
    // vectors of the genes that can score.
    const rankOf = (i: number) => {
      const hits = termHits.get(i) ?? 0
      if (unique.length === 1 && hits === 0) return 0
      if (unique.length > 1 && hits < 2) return RANK_FLOOR
      return tsRank(terms, this.vector(i))
    }

    const filterSpecies = species !== 'both'
    const matches: {
      gene: IndexedGene
      exact: number
      rank: number
      tier: number
    }[] = []
    this.genes.forEach((gene, i) => {
      if (filterSpecies && gene.species !== species) return
      const fullText = unique.length > 0 && termHits.get(i) === unique.length
      if (
        !fullText &&
        !gene.lowerSymbol.includes(lowerQuery) &&
        !gene.lowerName.includes(lowerQuery) &&
        !gene.lowerAlternateSymbols.includes(lowerQuery)
      ) {
        return
      }
      matches.push({
        gene,
        exact: gene.lowerSymbol === lowerQuery ? 0 : 1,
        rank: rankOf(i),
        tier: gene.lowerSymbol.startsWith(lowerQuery)
          ? 1
          : gene.lowerName.startsWith(lowerQuery)
            ? 2
            : gene.lowerSymbol.includes(lowerQuery)
              ? 3
              : gene.lowerName.includes(lowerQuery)
                ? 4
                : 5,
      })
    })

    matches.sort(
      (a, b) =>
        a.exact - b.exact ||
        b.rank - a.rank ||
        a.tier - b.tier ||
        compareText(a.gene.name, b.gene.name) ||
        compareText(a.gene.id, b.gene.id),
    )
    return {
      results: matches.slice(0, limit).map((match) => toResult(match.gene)),
      truncated: matches.length > limit,
    }
  }

  /**
   * fetchGeneBySymbol: case-insensitive symbol, exact casing first, then
   * species, then id.
   */
  geneBySymbol(
    symbol: string,
    species: string | undefined,
  ): GeneSearchResult | null {
    const lower = symbol.toLowerCase()
    const filterSpecies = species !== undefined && species !== 'both'
    const [best] = this.genes
      .filter(
        (gene) =>
          gene.lowerSymbol === lower &&
          (!filterSpecies || gene.species === species),
      )
      .sort(
        (a, b) =>
          Number(a.symbol !== symbol) - Number(b.symbol !== symbol) ||
          compareText(a.species, b.species) ||
          compareText(a.id, b.id),
      )
    return best ? toResult(best) : null
  }

  /**
   * fetchSimilarGenes: symbols starting with the input, then containing it,
   * then sharing its first three characters; up to five, by symbol and
   * species. `lowerSymbol` is already trimmed and lowercased.
   */
  similarGenes(lowerSymbol: string): SimilarGene[] {
    const shortPrefix =
      lowerSymbol.length >= 3 ? lowerSymbol.slice(0, 3) : lowerSymbol
    const matches: { gene: IndexedGene; tier: number }[] = []
    for (const gene of this.genes) {
      const tier = gene.lowerSymbol.startsWith(lowerSymbol)
        ? 0
        : gene.lowerSymbol.includes(lowerSymbol)
          ? 1
          : gene.lowerSymbol.startsWith(shortPrefix)
            ? 2
            : -1
      if (tier >= 0) matches.push({ gene, tier })
    }
    matches.sort(
      (a, b) =>
        a.tier - b.tier ||
        compareText(a.gene.symbol, b.gene.symbol) ||
        compareText(a.gene.species, b.gene.species) ||
        compareText(a.gene.id, b.gene.id),
    )
    return matches
      .slice(0, 5)
      .map(({ gene }) => ({ symbol: gene.symbol, species: gene.species }))
  }

  /** fetchAllGeneSymbols, for the sitemap. */
  allSymbols(): { symbol: string; species: string }[] {
    return this.genes.map((gene) => ({
      symbol: gene.symbol,
      species: gene.species,
    }))
  }
}

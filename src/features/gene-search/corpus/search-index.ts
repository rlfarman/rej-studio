import type { GeneSearchResult } from '../types/search'
import type { GeneIndexFile, GeneTable } from './format'

/** One gene row, with the lowercased fields the lookups and ranking use. */
export interface IndexedGene {
  id: string
  symbol: string
  name: string
  species: string
  /** As stored: pipe-delimited with leading and trailing pipes, or ''. */
  alternateSymbols: string
  lowerSymbol: string
  lowerAlternateSymbols: string
}

/** Code-unit order: stable and locale-independent for this ASCII data. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function toResult(gene: IndexedGene): GeneSearchResult {
  return {
    id: gene.id,
    name: gene.name,
    symbol: gene.symbol,
    species: gene.species,
  }
}

/**
 * The gene index in memory, for exact lookups by id and symbol. Text search
 * over it is `GeneTextSearch` (./gene-text-search.ts), which `GeneCorpus`
 * loads on demand, so MiniSearch stays out of the pages that only look genes
 * up.
 */
export class GeneSearchIndex {
  readonly version: string
  readonly transcriptShards: number
  readonly genes: readonly IndexedGene[]
  private readonly byId: Map<string, IndexedGene>

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
      lowerAlternateSymbols: alternateSymbols[i].toLowerCase(),
    }))
    this.byId = new Map(this.genes.map((gene) => [gene.id, gene]))
  }

  /** A gene by exact Ensembl id. */
  gene(id: string): GeneSearchResult | null {
    const gene = this.byId.get(id)
    return gene ? toResult(gene) : null
  }

  /**
   * A gene by symbol: case-insensitive, exact casing first, then species,
   * then id.
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
}

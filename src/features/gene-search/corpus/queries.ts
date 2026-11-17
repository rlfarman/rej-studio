import { queryOptions } from '@tanstack/react-query'
import type { SpeciesFilter } from '@/lib/bio/species'
import { SEARCH_LIMITS, type GeneSearchResult } from '../types/search'
import type { IsoformListItem } from '../types/domain-types'
import { searchCorpus } from './client'
import { getBrowserCorpus } from './gene-data-url'

/*
 * What the pages read from the static corpus, as TanStack Query options so
 * a route loader (`queryClient.ensureQueryData`) and the page it renders
 * share one cache entry. A corpus version never changes, so nothing here
 * goes stale while the page is open.
 */

/** A gene and its isoforms, as the gene page shows them. */
export interface GeneWithIsoforms {
  gene: GeneSearchResult
  isoforms: IsoformListItem[]
}

/**
 * A gene by symbol, case-insensitively (exact casing first, then species),
 * with its isoforms. Null when the corpus has no such gene; the caller
 * compares `gene.symbol` with what it asked for to find the canonical
 * casing.
 */
export function geneBySymbolQuery(symbol: string, species?: SpeciesFilter) {
  return queryOptions({
    queryKey: ['corpus', 'gene', symbol, species ?? null],
    queryFn: async (): Promise<GeneWithIsoforms | null> => {
      const corpus = getBrowserCorpus()
      const gene = (await corpus.loadIndex()).geneBySymbol(symbol, species)
      if (!gene) return null
      const file = await corpus.geneFile(gene.id)
      return { gene, isoforms: file?.isoforms ?? [] }
    },
    staleTime: Infinity,
  })
}

/** An isoform with its gene, for the design tool's `?isoform=` prefill. */
export interface IsoformWithGene {
  isoform: Pick<IsoformListItem, 'id' | 'species' | 'codingSequence'>
  gene: Pick<GeneSearchResult, 'id' | 'name' | 'symbol'>
}

/** Resolves null when the corpus has no such transcript. */
export function isoformWithGeneQuery(isoformId: string) {
  return queryOptions({
    queryKey: ['corpus', 'isoform', isoformId],
    queryFn: async (): Promise<IsoformWithGene | null> => {
      const corpus = getBrowserCorpus()
      const geneId = await corpus.geneIdOfTranscript(isoformId)
      const gene = geneId ? await corpus.geneFile(geneId) : null
      const isoform = gene?.isoforms.find(({ id }) => id === isoformId)
      if (!gene || !isoform) return null
      return {
        isoform: {
          id: isoform.id,
          species: isoform.species,
          codingSequence: isoform.codingSequence,
        },
        gene: { id: gene.id, name: gene.name, symbol: gene.symbol },
      }
    },
    staleTime: Infinity,
  })
}

/**
 * "Did you mean" symbols for a gene URL that matched nothing. Never fails:
 * suggestions are a nicety on a not-found page, not worth an error.
 */
export function similarGenesQuery(symbol: string) {
  return queryOptions({
    queryKey: ['corpus', 'similar', symbol],
    queryFn: async () => {
      const cleaned = symbol.trim().toLowerCase().slice(0, 20)
      if (!cleaned) return []
      try {
        return await getBrowserCorpus().similarGenes(cleaned)
      } catch {
        return []
      }
    },
    staleTime: Infinity,
  })
}

/** The /genes page's results (the palette searches through useGeneSearch). */
export function geneSearchPageQuery(query: string, species: SpeciesFilter) {
  return queryOptions({
    queryKey: ['corpus', 'search-page', query, species],
    queryFn: () =>
      searchCorpus(getBrowserCorpus(), {
        q: query,
        species,
        limit: SEARCH_LIMITS.page,
      }),
    staleTime: Infinity,
  })
}

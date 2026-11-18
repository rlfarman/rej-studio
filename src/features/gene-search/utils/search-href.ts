import { linkOptions } from '@tanstack/react-router'
import { parseSpeciesParam, type SpeciesFilter } from '@/lib/bio/species'

/*
 * Typed destinations for the gene pages, for `<Link {...x}>` and
 * `navigate(x)` alike, so every way into a page writes the same URL.
 */

/** The /genes results page for a query; species 'both' is the default. */
export function searchPageLink(query: string, species: SpeciesFilter) {
  return linkOptions({
    to: '/genes',
    search: {
      q: query || undefined,
      species: species === 'both' ? undefined : species,
    },
  })
}

/**
 * A gene's page. `species` is the gene's own (a corpus string), kept only
 * when it is one the page filters on; `isoformId` opens that isoform.
 */
export function geneLink(symbol: string, species?: string, isoformId?: string) {
  return linkOptions({
    to: '/genes/$symbol',
    params: { symbol },
    search: { species: parseSpeciesParam(species), isoform: isoformId },
  })
}

/**
 * Gene search doesn't index phenotypes, so disease searches go to the
 * associations explorer, prefilled with the query.
 */
export function diseaseSearchLink(query: string) {
  return linkOptions({ to: '/disease-associations', search: { q: query } })
}

import type { SpeciesFilter } from '@/lib/bio/species'

/** The /genes results page for a query; species 'both' is the default. */
export function searchPageHref(query: string, species: SpeciesFilter) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (species !== 'both') params.set('species', species)
  const qs = params.toString()
  return qs ? `/genes?${qs}` : '/genes'
}

/**
 * Gene search doesn't index phenotypes, so disease searches go to the
 * associations explorer, prefilled with the query.
 */
export function diseaseSearchHref(query: string) {
  const qs = new URLSearchParams({ q: query }).toString()
  return `/disease-associations?${qs}`
}

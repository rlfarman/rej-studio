import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { isSpecies, SPECIES_DISPLAY_NAME } from '@/lib/bio/species'
import { cn } from '@/lib/utils'
import type { SimilarGene } from '@/features/gene-search/types/search'
import {
  diseaseSearchLink,
  geneLink,
} from '@/features/gene-search/utils/search-href'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.results

const linkClass =
  'text-primary focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none'

interface SearchEmptyStateProps {
  query: string
  /** Display name of the active species filter, if any (e.g. "Mouse"). */
  speciesLabel?: string
  /** Widens the search to all species: a link on the page, a button in the palette. */
  allSpeciesAction?: ReactNode
  suggestions: SimilarGene[]
  /** Called when a link is followed, so the palette can close itself. */
  onNavigate?: () => void
  className?: string
}

/**
 * What to do when a search finds nothing: widen the species filter, follow a
 * "did you mean" symbol, look the term up as a disease, or bring your own
 * sequence. Shared by the /genes page and the command palette.
 */
export function SearchEmptyState({
  query,
  speciesLabel,
  allSpeciesAction,
  suggestions,
  onNavigate,
  className,
}: SearchEmptyStateProps) {
  return (
    <div className={cn('flex flex-col gap-3 text-sm', className)}>
      <p>
        {speciesLabel
          ? copy.noMatchesInSpecies(query, speciesLabel)
          : copy.noMatches(query)}{' '}
        {allSpeciesAction}
      </p>
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground">{copy.didYouMean}</p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((gene) => (
              <li key={`${gene.symbol}-${gene.species}`}>
                <Link
                  {...geneLink(gene.symbol, gene.species)}
                  onClick={onNavigate}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 font-mono text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:min-h-8"
                >
                  <SpeciesIcon species={gene.species} className="!size-3.5" />
                  {gene.symbol}
                  {/* Suggestions ignore the species filter — they are what
                      exists, not what was filtered for — so a suggestion is
                      usually in the other species, and a chip reading just
                      "INS" under "No mouse genes match INS" looks like the
                      search contradicting itself. The icon alone said it,
                      and the icon is decorative. */}
                  <span className="font-sans font-normal text-muted-foreground">
                    {isSpecies(gene.species)
                      ? SPECIES_DISPLAY_NAME[gene.species]
                      : gene.species}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-muted-foreground">
        {copy.diseasePrompt}{' '}
        <Link
          {...diseaseSearchLink(query)}
          onClick={onNavigate}
          className={linkClass}
        >
          {copy.diseaseLink}
        </Link>
      </p>
      <p>
        <Link to="/design-tool" onClick={onNavigate} className={linkClass}>
          {copy.enterCustom}
        </Link>
      </p>
    </div>
  )
}

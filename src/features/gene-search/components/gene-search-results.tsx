'use client'

import { useEffect, useState } from 'react'
import {
  searchGenesClient,
  type GeneSearchResult,
} from '@/features/gene-search/utils/client-search'
import { geneHref, type SpeciesFilter } from '@/lib/bio/species'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { SearchRetryButton } from './search-retry-button'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.results

interface GeneSearchResultsProps {
  query: string
  species: SpeciesFilter
}

export function GeneSearchResults({ query, species }: GeneSearchResultsProps) {
  const [results, setResults] = useState<GeneSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchGenesClient(query, species).then(
      (out) => {
        if (cancelled) return
        setResults(out)
        setLoading(false)
      },
      (err) => {
        if (cancelled) return
        console.error('[gene-search-results]', err)
        setError('Search is temporarily unavailable.')
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [query, species])

  if (loading) return <GeneSearchResultsLoading />

  if (error) {
    return (
      <div className="text-destructive-foreground bg-destructive/10 flex flex-col items-center gap-2 rounded-lg py-6 text-center text-sm">
        <span>
          {error} {copy.errorSuffix}
        </span>
        <SearchRetryButton />
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        {copy.noMatches(query)}{' '}
        <Link
          href="/design-tool"
          className="text-primary font-medium underline underline-offset-4"
        >
          {copy.enterCustom}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="type-overline px-1">
        {results.length} {results.length === 1 ? 'result' : 'results'}
      </p>
      <ul className="divide-border divide-y">
        {results.map((gene, i) => (
          <li
            key={gene.id}
            className="fade-up-stagger group/gene-row hover:bg-accent/60 flex items-center gap-4 rounded-md pr-1 transition-colors"
            style={{ '--stagger': i } as React.CSSProperties}
          >
            <Link
              href={geneHref(gene.symbol, gene.species, gene.matchedIsoformId)}
              prefetch
              className="flex min-w-0 flex-1 items-center gap-4 px-2 py-2.5"
            >
              <Badge className="grid w-24 shrink-0 grid-cols-[24px_1fr] items-center gap-2 font-mono">
                <SpeciesIcon species={gene.species} className="h-4 w-4" />
                <span className="truncate">{gene.symbol}</span>
              </Badge>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm">{gene.name}</span>
                {gene.matchedIsoformId && (
                  <span className="text-muted-foreground group-hover/gene-row:text-accent-foreground truncate font-mono text-xs">
                    {gene.matchedIsoformId}
                  </span>
                )}
              </div>
            </Link>
            {gene.matchedIsoformId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                  >
                    <Link
                      href={`/design-tool?isoform=${gene.matchedIsoformId}`}
                      aria-label={geneSearchCopy.command.customizeAria(
                        gene.matchedIsoformId,
                      )}
                    >
                      <span className="hidden sm:inline">
                        {geneSearchCopy.command.customize}
                      </span>
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {geneSearchCopy.command.customizeAria(gene.matchedIsoformId)}
                </TooltipContent>
              </Tooltip>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function GeneSearchResultsLoading() {
  return (
    <p className="text-muted-foreground px-2 py-4 text-sm" aria-live="polite">
      Loading…
    </p>
  )
}

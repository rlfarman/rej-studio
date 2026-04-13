import { searchGenes } from '@/features/gene-search/api/genes'
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
import { Skeleton } from '@/components/ui/skeleton'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { SearchRetryButton } from './search-retry-button'

interface GeneSearchResultsProps {
  query: string
  species: SpeciesFilter
}

export async function GeneSearchResults({
  query,
  species,
}: GeneSearchResultsProps) {
  const { results, error } = await searchGenes(query, species)

  if (error) {
    return (
      <div className="text-destructive-foreground bg-destructive/10 flex flex-col items-center gap-2 rounded-lg py-6 text-center text-sm">
        <span>{error} Try again in a moment.</span>
        <SearchRetryButton />
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No genes match &ldquo;{query}&rdquo;.{' '}
        <Link
          href="/design-tool"
          className="text-primary font-medium underline underline-offset-4"
        >
          Enter a custom sequence instead.
        </Link>
      </div>
    )
  }

  return (
    <div className="divide-border divide-y rounded-lg border">
      {results.map((gene, i) => (
        <div
          key={gene.id}
          className="fade-up-stagger hover:bg-accent flex items-center gap-4 pr-2 transition-colors"
          style={{ '--stagger': i } as React.CSSProperties}
        >
          <Link
            href={geneHref(gene.symbol, gene.species, gene.matchedIsoformId)}
            className="flex flex-1 items-center gap-4 px-4 py-3"
          >
            <Badge className="grid w-24 shrink-0 grid-cols-[24px_1fr] items-center gap-2 font-mono">
              <SpeciesIcon species={gene.species} className="h-4 w-4" />
              <span className="truncate">{gene.symbol}</span>
            </Badge>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm">{gene.name}</span>
              {gene.matchedIsoformId && (
                <span className="text-muted-foreground font-mono text-xs">
                  {gene.matchedIsoformId}
                </span>
              )}
            </div>
          </Link>
          {gene.matchedIsoformId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    href={`/design-tool?isoform=${gene.matchedIsoformId}`}
                    aria-label={`Customize ${gene.matchedIsoformId}`}
                  >
                    Customize
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Customize {gene.matchedIsoformId}</TooltipContent>
            </Tooltip>
          )}
        </div>
      ))}
    </div>
  )
}

export function GeneSearchResultsLoading({ rows = 5 }: { rows?: number } = {}) {
  return (
    <div className="divide-border divide-y rounded-lg border">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3"
          style={{ '--stagger': i } as React.CSSProperties}
        >
          <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

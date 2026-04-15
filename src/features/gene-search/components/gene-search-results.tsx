import { searchGenes } from '@/features/gene-search/api/genes'
import { geneHref, type SpeciesFilter } from '@/lib/bio/species'
import Link from 'next/link'
import { ArrowUpRight, ExternalLink } from 'lucide-react'
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
    <ol className="border-border/60 bg-card/40 divide-border/60 relative divide-y overflow-hidden rounded-xl border">
      {results.map((gene, i) => (
        <li
          key={gene.id}
          className="fade-up-stagger group hover:bg-accent/40 relative flex items-center gap-4 pr-2 transition-colors"
          style={{ '--stagger': i } as React.CSSProperties}
        >
          <span
            aria-hidden="true"
            className="from-brand to-accent-warm absolute inset-y-2 left-0 w-[3px] origin-center scale-y-0 rounded-full bg-gradient-to-b transition-transform duration-300 ease-out group-hover:scale-y-100"
          />
          <Link
            href={geneHref(gene.symbol, gene.species, gene.matchedIsoformId)}
            className="flex flex-1 items-center gap-5 py-4 pr-4 pl-6"
          >
            <span className="border-border/70 bg-background/60 text-foreground grid w-28 shrink-0 grid-cols-[20px_1fr] items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[13px] font-medium tracking-tight tabular-nums transition-colors group-hover:border-[color-mix(in_oklch,var(--brand)_40%,transparent)]">
              <SpeciesIcon
                species={gene.species}
                className="text-brand h-4 w-4"
              />
              <span className="truncate">{gene.symbol}</span>
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-foreground text-sm leading-snug">
                {gene.name}
              </span>
              {gene.matchedIsoformId && (
                <span className="text-muted-foreground font-mono text-[11px] tracking-tight">
                  {gene.matchedIsoformId}
                </span>
              )}
            </div>
            <ArrowUpRight
              className="text-muted-foreground/60 group-hover:text-brand size-4 shrink-0 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
              aria-hidden="true"
            />
          </Link>
          {gene.matchedIsoformId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link
                    href={`/design-tool?isoform=${gene.matchedIsoformId}`}
                    aria-label={`Customize ${gene.matchedIsoformId}`}
                  >
                    <span className="hidden sm:inline">Customize</span>
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Customize {gene.matchedIsoformId}</TooltipContent>
            </Tooltip>
          )}
        </li>
      ))}
    </ol>
  )
}

export function GeneSearchResultsLoading({ rows = 5 }: { rows?: number } = {}) {
  return (
    <div className="border-border/60 bg-card/40 divide-border/60 divide-y overflow-hidden rounded-xl border">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-5 py-4 pr-4 pl-6"
          style={{ '--stagger': i } as React.CSSProperties}
        >
          <Skeleton className="h-7 w-28 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

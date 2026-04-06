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
import { SpeciesIcon } from '@/components/bio/species-icon'

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
      <div className="text-destructive-foreground bg-destructive/10 rounded-lg py-6 text-center text-sm">
        {error} Try again in a moment.
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
      {results.map((gene) => (
        <div
          key={gene.id}
          className="hover:bg-accent flex items-center gap-4 pr-2 transition-colors"
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

export function GeneSearchResultsLoading() {
  return (
    <div className="text-muted-foreground py-8 text-center text-sm">
      Searching...
    </div>
  )
}

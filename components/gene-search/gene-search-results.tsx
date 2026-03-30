import { searchGenes } from '@/actions/genes'
import type { SpeciesFilter } from '@/lib/species'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { SpeciesIcon } from '@/components/species-icon'
import { Skeleton } from '@/components/ui/skeleton'

interface GeneSearchResultsProps {
  query: string
  species: SpeciesFilter
}

export async function GeneSearchResults({
  query,
  species,
}: GeneSearchResultsProps) {
  const results = await searchGenes(query, species)

  if (results.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No results found for &ldquo;{query}&rdquo;.{' '}
        <Link
          href="/design-tool"
          className="text-primary font-medium underline underline-offset-4"
        >
          Try entering a custom genetic sequence instead.
        </Link>
      </div>
    )
  }

  return (
    <div className="divide-border divide-y rounded-lg border">
      {results.map((gene) => (
        <Link
          key={gene.id}
          href={`/genes/${gene.symbol}`}
          className="hover:bg-accent flex items-center gap-4 px-4 py-3 transition-colors"
        >
          <Badge className="grid w-[96px] shrink-0 items-center gap-2 font-mono" style={{ gridTemplateColumns: '24px 1fr' }}>
            <SpeciesIcon species={gene.species} className="h-4 w-4" />
            <span className="truncate">{gene.symbol}</span>
          </Badge>
          <span className="text-sm">{gene.name}</span>
        </Link>
      ))}
    </div>
  )
}

export function GeneSearchResultsSkeleton() {
  return (
    <div className="divide-border divide-y rounded-lg border">
      {[...Array(5)].map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 px-4 py-3"
        >
          <Skeleton className="h-6 w-[96px] rounded" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  )
}

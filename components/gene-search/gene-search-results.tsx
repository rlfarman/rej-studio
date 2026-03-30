import { searchGenes } from '@/actions/genes'
import type { SpeciesFilter } from '@/lib/species'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { SpeciesIcon } from '@/components/species-icon'

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
        <Link
          key={gene.id}
          href={`/genes/${gene.symbol}`}
          className="hover:bg-accent flex items-center gap-4 px-4 py-3 transition-colors"
        >
          <Badge className="grid w-[96px] shrink-0 grid-cols-[24px_1fr] items-center gap-2 font-mono">
            <SpeciesIcon species={gene.species} className="h-4 w-4" />
            <span className="truncate">{gene.symbol}</span>
          </Badge>
          <span className="text-sm">{gene.name}</span>
        </Link>
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

import Link from 'next/link'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SpeciesIcon } from '@/components/bio/species-icon'
import type { SpeciesFilter } from '@/lib/bio/species'
import { cn } from '@/lib/utils'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.searchPage

const SPECIES: { value: SpeciesFilter; label: string }[] = [
  { value: 'both', label: geneSearchCopy.command.speciesOptions.all },
  { value: 'human', label: geneSearchCopy.command.speciesOptions.human },
  { value: 'mouse', label: geneSearchCopy.command.speciesOptions.mouse },
]

export function searchPageHref(query: string, species: SpeciesFilter) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (species !== 'both') params.set('species', species)
  const qs = params.toString()
  return qs ? `/genes?${qs}` : '/genes'
}

interface GeneSearchPageFormProps {
  query: string
  species: SpeciesFilter
}

/**
 * The search page's only search box. A plain GET form, so it works before
 * hydration and the URL stays the source of truth (shareable, back/forward).
 * As-you-type search lives in the header's ⌘K / Ctrl+K palette; repeating it
 * here is what used to show every result twice.
 */
export function GeneSearchPageForm({
  query,
  species,
}: GeneSearchPageFormProps) {
  return (
    <div className="flex flex-col gap-3">
      <form action="/genes" method="get" role="search" className="flex gap-2">
        <label htmlFor="gene-query" className="sr-only">
          {copy.inputLabel}
        </label>
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="gene-query"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={geneSearchCopy.command.placeholder}
            autoComplete="off"
            spellCheck={false}
            className="h-11 pl-9"
          />
        </div>
        {species !== 'both' && (
          <input type="hidden" name="species" value={species} />
        )}
        <Button type="submit" className="h-11 px-5">
          {copy.submit}
        </Button>
      </form>
      <nav aria-label={copy.speciesLabel} className="flex flex-wrap gap-1">
        {SPECIES.map(({ value, label }) => {
          const active = species === value
          return (
            <Link
              key={value}
              href={searchPageHref(query, value)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-ring flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
              )}
            >
              <SpeciesIcon species={value} className="!size-3.5" />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

import { Link, useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SpeciesIcon } from '@/components/bio/species-icon'
import type { SpeciesFilter } from '@/lib/bio/species'
import { cn } from '@/lib/utils'
import { searchPageLink } from '@/features/gene-search/utils/search-href'
import { geneSearchCopy } from '../copy'
import {
  SearchShortcutFocus,
  SearchShortcutHint,
} from '@/components/search-shortcut'
import { SEARCH_SHORTCUT_ARIA } from '@/lib/search-shortcut'

const copy = geneSearchCopy.searchPage

const SPECIES: { value: SpeciesFilter; label: string }[] = [
  { value: 'both', label: geneSearchCopy.command.speciesOptions.all },
  { value: 'human', label: geneSearchCopy.command.speciesOptions.human },
  { value: 'mouse', label: geneSearchCopy.command.speciesOptions.mouse },
]

interface GeneSearchPageFormProps {
  query: string
  species: SpeciesFilter
}

/**
 * The search page's only search box. Submitting navigates to the results
 * URL, so the URL stays the source of truth (shareable, back/forward); the
 * GET action is only a fallback for a submit before the app has loaded.
 * The header's as-you-type palette is hidden on this page, so ⌘K / Ctrl+K
 * focuses this box instead.
 */
export function GeneSearchPageForm({
  query,
  species,
}: GeneSearchPageFormProps) {
  const navigate = useNavigate()

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = new FormData(event.currentTarget).get('q')
    void navigate(
      searchPageLink(typeof q === 'string' ? q.trim() : '', species),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        action="/genes"
        method="get"
        role="search"
        className="flex gap-2"
        onSubmit={onSubmit}
      >
        <label htmlFor="gene-query" className="sr-only">
          {copy.inputLabel}
        </label>
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            // Remounted per query, so the box shows the URL's query after a
            // back/forward or an example link.
            key={query}
            id="gene-query"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={geneSearchCopy.command.placeholder}
            autoComplete="off"
            spellCheck={false}
            aria-keyshortcuts={SEARCH_SHORTCUT_ARIA}
            className="h-11 pl-9 md:pr-16"
          />
          <SearchShortcutHint className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
          <SearchShortcutFocus targetId="gene-query" />
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
              {...searchPageLink(query, value)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
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

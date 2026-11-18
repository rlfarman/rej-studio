import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useDebouncedCallback } from 'use-debounce'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FILTER_INHERITANCE_BUCKETS,
  formatInheritanceLabel,
  type InheritanceBucket,
} from '../types'
import { diseaseAssociationsCopy } from '../copy'

const DEBOUNCE_MS = 200

type Props = {
  bucketCounts: Record<InheritanceBucket, number>
  /** The URL's text filter. */
  query: string
  /** The URL's inheritance filter. */
  inheritance: InheritanceBucket[]
}

export function AssociationsFilters({
  bucketCounts,
  query: urlQuery,
  inheritance,
}: Props) {
  const navigate = useNavigate({ from: '/disease-associations' })

  const activeBuckets = new Set<string>(inheritance)
  const [query, setQuery] = useState(urlQuery)

  // Filters live in the URL. Replacing the entry keeps typing out of the
  // back history; the table re-filters on the client, so nothing reloads.
  const setFilters = (next: { q?: string; i?: InheritanceBucket[] }) => {
    void navigate({
      search: (prev) => ({ ...prev, ...next }),
      replace: true,
      resetScroll: false,
    })
  }

  // Debounce query updates so the table doesn't re-render on every keystroke.
  // Driven from the input's change event rather than an effect.
  const pushQuery = useDebouncedCallback((value: string) => {
    if (value !== urlQuery) setFilters({ q: value || undefined })
  }, DEBOUNCE_MS)

  const toggleBucket = (bucket: InheritanceBucket) => {
    const next = activeBuckets.has(bucket)
      ? inheritance.filter((b) => b !== bucket)
      : [...inheritance, bucket]
    setFilters({ i: next.length > 0 ? next : undefined })
  }

  const clearAll = () => {
    pushQuery.cancel()
    setQuery('')
    void navigate({ search: {}, replace: true, resetScroll: false })
  }

  const hasFilters = query.length > 0 || activeBuckets.size > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            pushQuery(e.target.value)
          }}
          placeholder={diseaseAssociationsCopy.filters.searchPlaceholder}
          aria-label={diseaseAssociationsCopy.filters.searchAria}
          className="max-w-lg bg-card shadow-xs"
        />
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground"
          >
            <X className="size-3.5" aria-hidden />
            {diseaseAssociationsCopy.filters.clearAll}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 type-overline">
          {diseaseAssociationsCopy.filters.inheritanceLabel}
        </span>
        {FILTER_INHERITANCE_BUCKETS.map((bucket) => {
          const active = activeBuckets.has(bucket)
          const count = bucketCounts[bucket]
          if (count === 0) return null
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => toggleBucket(bucket)}
              aria-pressed={active}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card text-foreground hover:bg-muted',
              )}
            >
              {formatInheritanceLabel(bucket)}
              <span
                className={cn(
                  'ml-1.5 font-mono type-micro',
                  active ? 'opacity-80' : 'text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

const SEARCH_PARAM = 'q'
const INHERIT_PARAM = 'i'
const DEBOUNCE_MS = 200

type Props = {
  bucketCounts: Record<InheritanceBucket, number>
}

export function AssociationsFilters({ bucketCounts }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const activeBuckets = new Set(searchParams.getAll(INHERIT_PARAM))
  const initialQuery = searchParams.get(SEARCH_PARAM) ?? ''
  const [query, setQuery] = useState(initialQuery)

  const pushParams = (next: URLSearchParams) => {
    const qs = next.toString()
    startTransition(() => {
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    })
  }

  // Debounce query updates so the table doesn't re-render on every keystroke.
  // Driven from the input's change event rather than an effect.
  const pushQuery = useDebouncedCallback((value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(SEARCH_PARAM, value)
    else next.delete(SEARCH_PARAM)
    if (next.toString() !== searchParams.toString()) pushParams(next)
  }, DEBOUNCE_MS)

  const toggleBucket = (bucket: InheritanceBucket) => {
    const next = new URLSearchParams(searchParams)
    const current = next.getAll(INHERIT_PARAM)
    next.delete(INHERIT_PARAM)
    if (current.includes(bucket)) {
      for (const b of current) if (b !== bucket) next.append(INHERIT_PARAM, b)
    } else {
      for (const b of current) next.append(INHERIT_PARAM, b)
      next.append(INHERIT_PARAM, bucket)
    }
    pushParams(next)
  }

  const clearAll = () => {
    pushQuery.cancel()
    setQuery('')
    pushParams(new URLSearchParams())
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
        <span className="mr-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
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
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
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

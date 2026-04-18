'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INHERITANCE_BUCKETS, type InheritanceBucket } from '../types'
import { diseaseLandscapeCopy } from '../copy'

const SEARCH_PARAM = 'q'
const INHERIT_PARAM = 'i'
const DEBOUNCE_MS = 200

type Props = {
  bucketCounts: Record<InheritanceBucket, number>
}

export function LandscapeFilters({ bucketCounts }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const activeBuckets = new Set(searchParams.getAll(INHERIT_PARAM))
  const initialQuery = searchParams.get(SEARCH_PARAM) ?? ''
  const [query, setQuery] = useState(initialQuery)

  const pushParams = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString()
      startTransition(() => {
        router.replace(qs ? `?${qs}` : '?', { scroll: false })
      })
    },
    [router],
  )

  // Debounce query updates so the table doesn't re-render on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (query) next.set(SEARCH_PARAM, query)
      else next.delete(SEARCH_PARAM)
      if (next.toString() !== searchParams.toString()) pushParams(next)
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query, searchParams, pushParams])

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
          onChange={(e) => setQuery(e.target.value)}
          placeholder={diseaseLandscapeCopy.filters.searchPlaceholder}
          aria-label={diseaseLandscapeCopy.filters.searchAria}
          className="max-w-lg"
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
            {diseaseLandscapeCopy.filters.clearAll}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground mr-1 text-xs font-semibold tracking-wider uppercase">
          {diseaseLandscapeCopy.filters.inheritanceLabel}
        </span>
        {INHERITANCE_BUCKETS.map((bucket) => {
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
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground hover:bg-muted',
              )}
            >
              {bucket}
              <span
                className={cn(
                  'ml-1.5 font-mono text-[10px]',
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

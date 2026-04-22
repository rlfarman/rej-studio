'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import associations from '../data/associations.json'
import type { AssociationData, InheritanceBucket } from '../types'
import { INHERITANCE_BUCKETS } from '../types'
import {
  bucketCounts,
  filterAssociations,
  sortAssociations,
  SORT_KEYS,
  type SortDir,
  type SortKey,
} from '../api/associations'
import { AssociationsFilters } from './associations-filters'
import { AssociationsPagination } from './associations-pagination'
import { AssociationsTable } from './associations-table'
import { diseaseAssociationsCopy } from '../copy'

const PAGE_SIZE = 50

// The full dataset lives in a static JSON and is imported into the client
// bundle — filtering, sorting, and pagination all run in-browser. URL state
// stays the source of truth so links remain shareable. The previous version
// re-ran all of this on the server for every keystroke; now the page shell is
// fully static and filter changes never round-trip.
const data = associations as AssociationData
const allRows = data.rows
const counts = bucketCounts(allRows)

function normalizeInheritance(values: string[]): InheritanceBucket[] {
  const valid = new Set<string>(INHERITANCE_BUCKETS)
  return values.filter((v): v is InheritanceBucket => valid.has(v))
}

function normalizeSort(raw: string | null): SortKey {
  return (SORT_KEYS as readonly string[]).includes(raw ?? '')
    ? (raw as SortKey)
    : 'symbol'
}

function normalizeDir(raw: string | null, key: SortKey): SortDir {
  if (raw === 'asc' || raw === 'desc') return raw
  return key === 'symbol' ? 'asc' : 'desc'
}

export function AssociationsExplorer() {
  const searchParams = useSearchParams()

  const q = searchParams.get('q') ?? undefined
  const inheritance = normalizeInheritance(searchParams.getAll('i'))
  const sortKey = normalizeSort(searchParams.get('sort'))
  const sortDir = normalizeDir(searchParams.get('dir'), sortKey)
  const pageParam = searchParams.get('page')

  const sorted = useMemo(
    () =>
      sortAssociations(
        filterAssociations(allRows, { query: q, inheritance }),
        sortKey,
        sortDir,
      ),
    [q, inheritance, sortKey, sortDir],
  )

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(
    Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1),
    totalPages,
  )
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE)

  // AssociationsTable / AssociationsPagination expect a plain-object snapshot
  // of search params so they can rebuild sort/page links while preserving
  // filters. Reconstruct it from the live URLSearchParams.
  const paramsSnapshot: Record<string, string | string[] | undefined> = {}
  for (const key of new Set(Array.from(searchParams.keys()))) {
    const values = searchParams.getAll(key)
    paramsSnapshot[key] = values.length === 1 ? values[0] : values
  }

  return (
    <>
      <AssociationsFilters bucketCounts={counts} />

      <div className="text-muted-foreground text-xs" aria-live="polite">
        {diseaseAssociationsCopy.table.resultsSummary(
          sorted.length,
          allRows.length,
        )}
      </div>

      <AssociationsTable
        rows={pageRows}
        sortKey={sortKey}
        sortDir={sortDir}
        searchParams={paramsSnapshot}
      />

      <AssociationsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageStart={sorted.length === 0 ? 0 : pageStart + 1}
        pageEnd={pageStart + pageRows.length}
        total={sorted.length}
        searchParams={paramsSnapshot}
      />
    </>
  )
}

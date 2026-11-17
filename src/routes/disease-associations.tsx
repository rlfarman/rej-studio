import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { appCopy } from '@/copy/app'
import {
  SORT_KEYS,
  associationsQuery,
  bucketCounts,
  filterAssociations,
  sortAssociations,
  type SortDir,
  type SortKey,
} from '@/features/disease-associations/api/associations'
import { AssociationsFilters } from '@/features/disease-associations/components/associations-filters'
import { AssociationsPagination } from '@/features/disease-associations/components/associations-pagination'
import {
  AssociationsTable,
  AssociationsTableSkeleton,
} from '@/features/disease-associations/components/associations-table'
import { diseaseAssociationsCopy } from '@/features/disease-associations/copy'
import { INHERITANCE_BUCKETS } from '@/features/disease-associations/types'
import {
  searchList,
  searchOneOf,
  searchPositiveInt,
  searchText,
} from './-components/search-params'

const PAGE_SIZE = 50

const searchSchema = z.object({
  q: searchText,
  /** Inheritance buckets; a gene matches any of them. */
  i: searchList(INHERITANCE_BUCKETS),
  sort: searchOneOf(SORT_KEYS),
  dir: searchOneOf(['asc', 'desc']),
  page: searchPositiveInt,
})

function defaultDir(key: SortKey): SortDir {
  return key === 'symbol' ? 'asc' : 'desc'
}

export const Route = createFileRoute('/disease-associations')({
  validateSearch: (search) => searchSchema.parse(search),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(associationsQuery),
  // Internal page: kept out of search engines, as before.
  head: () => ({
    meta: [
      { title: appCopy.metadata.title(diseaseAssociationsCopy.page.title) },
      { name: 'description', content: diseaseAssociationsCopy.page.subtitle },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: DiseaseAssociationsPage,
  pendingComponent: () => (
    <PageFrame>
      <AssociationsTableSkeleton />
    </PageFrame>
  ),
})

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-mono text-2xl font-bold tracking-tight md:text-3xl">
          {diseaseAssociationsCopy.page.title}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {diseaseAssociationsCopy.page.subtitle}
        </p>
        <p className="text-xs text-muted-foreground">
          {diseaseAssociationsCopy.page.sourceLabel}:{' '}
          <a
            href="https://omim.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {diseaseAssociationsCopy.page.source}
          </a>
        </p>
      </header>
      {children}
    </div>
  )
}

function DiseaseAssociationsPage() {
  const search = Route.useSearch()
  const { data: all } = useSuspenseQuery(associationsQuery)

  // The React Compiler memoizes these on their inputs.
  const counts = bucketCounts(all)
  const filtered = filterAssociations(all, {
    query: search.q,
    inheritance: search.i,
  })
  const sortKey = search.sort ?? 'symbol'
  const sortDir = search.dir ?? defaultDir(sortKey)
  const sorted = sortAssociations(filtered, sortKey, sortDir)

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(search.page ?? 1, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <PageFrame>
      <AssociationsFilters
        bucketCounts={counts}
        query={search.q ?? ''}
        inheritance={search.i ?? []}
      />

      <div className="text-xs text-muted-foreground" aria-live="polite">
        {diseaseAssociationsCopy.table.resultsSummary(
          sorted.length,
          all.length,
        )}
      </div>

      <AssociationsTable rows={pageRows} sortKey={sortKey} sortDir={sortDir} />

      <AssociationsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageStart={sorted.length === 0 ? 0 : pageStart + 1}
        pageEnd={pageStart + pageRows.length}
        total={sorted.length}
      />
    </PageFrame>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  getAssociations,
  filterAssociations,
  bucketCounts,
  sortAssociations,
  SORT_KEYS,
  type SortDir,
  type SortKey,
} from '@/features/disease-associations/api/associations'
import { AssociationsFilters } from '@/features/disease-associations/components/associations-filters'
import { AssociationsTable } from '@/features/disease-associations/components/associations-table'
import { diseaseAssociationsCopy } from '@/features/disease-associations/copy'
import {
  INHERITANCE_BUCKETS,
  type InheritanceBucket,
} from '@/features/disease-associations/types'

export const metadata: Metadata = {
  title: diseaseAssociationsCopy.page.title,
  description: diseaseAssociationsCopy.page.subtitle,
  robots: { index: false, follow: false },
}

type SearchParams = {
  q?: string
  i?: string | string[]
  sort?: string
  dir?: string
}

type Props = {
  searchParams: Promise<SearchParams>
}

function normalizeInheritance(
  value: string | string[] | undefined,
): InheritanceBucket[] {
  if (!value) return []
  const list = Array.isArray(value) ? value : [value]
  const valid = new Set<string>(INHERITANCE_BUCKETS)
  return list.filter((v): v is InheritanceBucket => valid.has(v))
}

function normalizeSort(raw: string | undefined): SortKey {
  return (SORT_KEYS as readonly string[]).includes(raw ?? '')
    ? (raw as SortKey)
    : 'symbol'
}

function normalizeDir(raw: string | undefined, key: SortKey): SortDir {
  if (raw === 'asc' || raw === 'desc') return raw
  return key === 'symbol' ? 'asc' : 'desc'
}

export default async function DiseaseAssociationsPage({ searchParams }: Props) {
  const params = await searchParams
  const { q, i, sort, dir } = params
  const all = getAssociations()
  const counts = bucketCounts(all)
  const filtered = filterAssociations(all, {
    query: q,
    inheritance: normalizeInheritance(i),
  })
  const sortKey = normalizeSort(sort)
  const sortDir = normalizeDir(dir, sortKey)
  const sorted = sortAssociations(filtered, sortKey, sortDir)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-mono text-2xl font-bold tracking-tight md:text-3xl">
          {diseaseAssociationsCopy.page.title}
        </h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          {diseaseAssociationsCopy.page.subtitle}
        </p>
        <p className="text-muted-foreground text-xs">
          {diseaseAssociationsCopy.page.sourceLabel}:{' '}
          <a
            href="https://omim.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline underline-offset-2"
          >
            {diseaseAssociationsCopy.page.source}
          </a>
        </p>
      </header>

      <Suspense>
        <AssociationsFilters bucketCounts={counts} />
      </Suspense>

      <div className="text-muted-foreground text-xs" aria-live="polite">
        {diseaseAssociationsCopy.table.resultsSummary(
          sorted.length,
          all.length,
        )}
      </div>

      <AssociationsTable
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        searchParams={params}
      />
    </div>
  )
}

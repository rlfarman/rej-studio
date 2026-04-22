import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  getLandscape,
  filterLandscape,
  bucketCounts,
  fetchMaxCdsLengthByGeneId,
} from '@/features/disease-landscape/api/landscape'
import { LandscapeFilters } from '@/features/disease-landscape/components/landscape-filters'
import { LandscapeTable } from '@/features/disease-landscape/components/landscape-table'
import { diseaseLandscapeCopy } from '@/features/disease-landscape/copy'
import {
  INHERITANCE_BUCKETS,
  type InheritanceBucket,
} from '@/features/disease-landscape/types'

export const metadata: Metadata = {
  title: diseaseLandscapeCopy.page.title,
  description: diseaseLandscapeCopy.page.subtitle,
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ q?: string; i?: string | string[] }>
}

function normalizeInheritance(
  value: string | string[] | undefined,
): InheritanceBucket[] {
  if (!value) return []
  const list = Array.isArray(value) ? value : [value]
  const valid = new Set<string>(INHERITANCE_BUCKETS)
  return list.filter((v): v is InheritanceBucket => valid.has(v))
}

export default async function DiseaseLandscapePage({ searchParams }: Props) {
  const { q, i } = await searchParams
  const all = getLandscape()
  const counts = bucketCounts(all)
  const filtered = filterLandscape(all, {
    query: q,
    inheritance: normalizeInheritance(i),
  })
  const maxCdsByGeneId = await fetchMaxCdsLengthByGeneId()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-mono text-2xl font-bold tracking-tight md:text-3xl">
          {diseaseLandscapeCopy.page.title}
        </h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          {diseaseLandscapeCopy.page.subtitle}
        </p>
        <p className="text-muted-foreground text-xs">
          {diseaseLandscapeCopy.page.sourceLabel}:{' '}
          <a
            href="https://omim.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline underline-offset-2"
          >
            {diseaseLandscapeCopy.page.source}
          </a>
        </p>
      </header>

      <Suspense>
        <LandscapeFilters bucketCounts={counts} />
      </Suspense>

      <div className="text-muted-foreground text-xs" aria-live="polite">
        {diseaseLandscapeCopy.table.resultsSummary(filtered.length, all.length)}
      </div>

      <LandscapeTable rows={filtered} maxCdsByGeneId={maxCdsByGeneId} />
    </div>
  )
}

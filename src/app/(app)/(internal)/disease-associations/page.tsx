import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AssociationsExplorer } from '@/features/disease-associations/components/associations-explorer'
import { diseaseAssociationsCopy } from '@/features/disease-associations/copy'

export const metadata: Metadata = {
  title: diseaseAssociationsCopy.page.title,
  description: diseaseAssociationsCopy.page.subtitle,
  robots: { index: false, follow: false },
}

// Page is fully static — the explorer ships the dataset to the client and
// filters/sorts/paginates in-browser against URL state. Every visit hits the
// CDN; no server round-trip per keystroke.
export default function DiseaseAssociationsPage() {
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
        <AssociationsExplorer />
      </Suspense>
    </div>
  )
}

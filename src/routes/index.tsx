import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { PageTitle } from '@/components/page-title'
import { appCopy } from '@/copy/app'
import { GeneSearchShell } from './-components/gene-search-shell'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: appCopy.home.metadataTitle },
      { name: 'description', content: appCopy.home.metadataDescription },
    ],
  }),
  component: HomePage,
})

/**
 * Search-first home: a centered question over the search box, in the upper
 * third where the eye lands. No entrance animation — the search is the page,
 * and it should be there (and focused) the moment the page is.
 */
function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pt-[clamp(3rem,18vh,10rem)] pb-16 text-center sm:px-6">
      <p className="mb-3 type-overline text-muted-foreground">
        {appCopy.home.eyebrow}
      </p>
      <PageTitle className="text-balance text-primary">
        {appCopy.home.searchPrompt}
      </PageTitle>
      <div className="mt-8 w-full text-left">
        <GeneSearchShell />
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        {appCopy.home.ownSequence}{' '}
        <Link
          to="/design-tool"
          className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {appCopy.home.designLink}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
    </div>
  )
}

import Link from 'next/link'
import { GeneSearchShell } from '@/app/_components/gene-search-shell'
import { ArrowRight } from 'lucide-react'
import { PageTitle } from '@/components/page-title'
import type { Metadata } from 'next'
import { appCopy } from '@/copy/app'

export const metadata: Metadata = {
  title: appCopy.home.metadataTitle,
  description: appCopy.home.metadataDescription,
  alternates: { canonical: '/' },
  openGraph: {
    title: appCopy.home.ogTitle,
    description: appCopy.home.ogDescription,
    url: '/',
    images: [
      {
        url: '/api/og?title=RNA+End-Joining%0Asequence+design&description=Search+genes+%C2%B7+Browse+isoforms+%C2%B7+Optimize+sequences&url=rejstudio.com',
        width: 1200,
        height: 630,
        alt: 'REJ Studio — RNA End-Joining made easy',
      },
    ],
  },
}

/**
 * Search-first home: a centered question over the search box, in the upper
 * third where the eye lands. No entrance animation — the search is the page,
 * and it should be there (and focused) the moment the page is.
 */
export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pt-[clamp(3rem,18vh,10rem)] pb-16 text-center sm:px-6">
      <p className="type-overline text-muted-foreground mb-3">
        {appCopy.home.eyebrow}
      </p>
      <PageTitle className="text-primary text-balance">
        {appCopy.home.searchPrompt}
      </PageTitle>
      <div className="mt-8 w-full text-left">
        <GeneSearchShell />
      </div>
      <p className="text-muted-foreground mt-5 text-sm">
        {appCopy.home.ownSequence}{' '}
        <Link
          href="/design-tool"
          className="text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {appCopy.home.designLink}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
    </div>
  )
}

import Link from 'next/link'
import { GeneSearchShell } from '@/app/_components/gene-search-shell'
import { searchGenes } from '@/features/gene-search/api/genes'
import { ArrowRight } from 'lucide-react'
import { Hero, HeroItem } from '@/app/_components/hero'
import { HomeTour } from '@/features/onboarding/components/home-tour'
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
 * Search-first home. Left-aligned and set in the upper third rather than an
 * icon-over-centered-question stack, so the search sits where the eye lands
 * and the example genes inside it double as the first-run hint.
 */
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-[clamp(2.5rem,14vh,8rem)] pb-16 sm:px-6">
      <Hero>
        <HeroItem index={0}>
          <p className="type-overline text-muted-foreground mb-3">
            {appCopy.home.eyebrow}
          </p>
        </HeroItem>
        <HeroItem index={1}>
          <PageTitle className="text-primary max-w-[20ch] text-balance">
            {appCopy.home.searchPrompt}
          </PageTitle>
        </HeroItem>
        <HeroItem index={2} className="mt-8" data-tour="home-search">
          <GeneSearchShell searchGenes={searchGenes} />
        </HeroItem>
        <HeroItem index={3} className="mt-5" data-tour="home-design-link">
          <p className="text-muted-foreground text-sm">
            {appCopy.home.ownSequence}{' '}
            <Link
              href="/design-tool"
              className="text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {appCopy.home.designLink}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </p>
        </HeroItem>
      </Hero>
      <HomeTour />
    </div>
  )
}

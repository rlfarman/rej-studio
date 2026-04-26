import Link from 'next/link'
import { GeneSearchShell } from '@/app/_components/gene-search-shell'

import { Dna } from 'lucide-react'
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

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Hero>
        <div className="mx-auto w-full max-w-2xl text-center">
          <HeroItem
            index={0}
            className="text-muted-foreground mb-6 flex items-center justify-center"
          >
            <Dna className="size-7 [animation:gentle-breath_4s_ease-in-out_infinite] [animation-delay:800ms] motion-reduce:animate-none" />
          </HeroItem>
          <HeroItem index={1}>
            <PageTitle className="text-primary">
              {appCopy.home.searchPrompt}
            </PageTitle>
          </HeroItem>
          <HeroItem index={2} className="mt-3">
            <p
              className="text-muted-foreground text-base"
              data-tour="home-design-link"
            >
              {appCopy.home.orPrefix}{' '}
              <Link
                href={{
                  pathname: '/design-tool',
                  query: { gene: 'ATM' },
                }}
                className="text-primary font-medium underline underline-offset-4"
              >
                {appCopy.home.designLink}
              </Link>
              .
            </p>
          </HeroItem>
        </div>
        <HeroItem
          index={3}
          className="mx-auto mt-10 w-full max-w-2xl"
          data-tour="home-search"
        >
          <GeneSearchShell />
        </HeroItem>
      </Hero>
      <HomeTour />
    </div>
  )
}

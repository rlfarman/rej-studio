import Link from 'next/link'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
import { searchGenes } from '@/features/gene-search/api/genes'
import { Dna } from 'lucide-react'
import { Hero, HeroItem } from '@/app/_components/hero'
import { HomeTour } from '@/features/onboarding/components/home-tour'
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
    <div className="absolute inset-0 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
      <Hero>
        <div className="mx-auto w-full max-w-2xl text-center">
          <HeroItem
            index={0}
            className="text-muted-foreground mb-6 flex items-center justify-center"
          >
            <Dna className="size-7" />
          </HeroItem>
          <HeroItem index={1}>
            <h1 className="text-primary text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {appCopy.home.searchPrompt}
            </h1>
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
          <GeneSearch searchGenes={searchGenes} />
        </HeroItem>
      </Hero>
      <HomeTour />
    </div>
  )
}

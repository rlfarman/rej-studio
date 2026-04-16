import Link from 'next/link'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
import { searchGenes } from '@/features/gene-search/api/genes'
import { Dna } from 'lucide-react'
import { Hero, HeroItem, DnaFloat } from '@/app/_components/hero'
import { HomeTour } from '@/features/onboarding/components/home-tour'
import type { Metadata } from 'next'
import { appCopy } from '@/lib/copy'
import { ogImageUrl } from '@/lib/og'

export const metadata: Metadata = {
  title: appCopy.home.title,
  description: appCopy.home.description,
  alternates: { canonical: '/' },
  openGraph: {
    title: appCopy.home.ogTitle,
    description: appCopy.home.ogDescription,
    url: '/',
    images: [
      {
        url: ogImageUrl({
          title: 'RNA End-Joining\nsequence design',
          description: 'Search genes · Browse isoforms · Optimize sequences',
          url: 'rejstudio.com',
        }),
        width: 1200,
        height: 630,
        alt: appCopy.home.ogImageAlt,
      },
    ],
  },
}

export default function HomePage() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <Hero>
        <div className="mx-auto mt-0 w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <HeroItem index={0} className="mb-4 flex items-center justify-center">
            <DnaFloat>
              <Dna className="mt-2 ml-2 size-6" />
            </DnaFloat>
          </HeroItem>
          <HeroItem index={1} className="pb-2 font-mono">
            {appCopy.home.subtitle}
          </HeroItem>
          <HeroItem index={2}>
            <h1 className="text-primary pb-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {appCopy.home.heading}
            </h1>
          </HeroItem>
          <HeroItem index={3}>
            <p className="text-muted-foreground" data-tour="home-design-link">
              {appCopy.home.designPromptPrefix}
              <Link
                href={{
                  pathname: '/design-tool',
                  query: { gene: 'ATM' },
                }}
                className="text-primary font-medium underline underline-offset-4"
              >
                {appCopy.home.designPromptLink}
              </Link>
              {appCopy.home.designPromptSuffix}
            </p>
          </HeroItem>
        </div>
        <HeroItem
          index={4}
          className="mx-auto mt-8 w-full max-w-2xl px-4 sm:px-6 lg:px-8"
          data-tour="home-search"
        >
          <GeneSearch searchGenes={searchGenes} />
        </HeroItem>
      </Hero>
      <HomeTour />
    </div>
  )
}

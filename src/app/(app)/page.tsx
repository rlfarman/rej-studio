import Link from 'next/link'
import { GeneSearchShell } from '@/app/_components/gene-search-shell'
import { searchGenes } from '@/features/gene-search/api/genes'
import { Dna, WandSparkles } from 'lucide-react'
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
    <div className="flex min-h-full flex-col items-center px-4 pt-[15vh] pb-12 sm:px-6 md:pt-[18vh] lg:px-8">
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
          <HeroItem
            index={2}
            className="mt-6 flex justify-center"
            data-tour="home-design-link"
          >
            <Link
              href={{
                pathname: '/design-tool',
                query: { gene: 'ATM' },
              }}
              className="group border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary focus-visible:ring-ring/50 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-base font-semibold shadow-xs transition-all duration-200 outline-none hover:shadow-sm focus-visible:ring-[3px]"
            >
              <WandSparkles className="size-4 transition-transform duration-200 group-hover:rotate-[-8deg]" />
              {appCopy.home.designLink}
            </Link>
          </HeroItem>
          <HeroItem index={3} className="mt-6">
            <p className="text-muted-foreground text-base">
              {appCopy.home.orPrefix}
            </p>
          </HeroItem>
        </div>
        <HeroItem
          index={4}
          className="mx-auto mt-4 w-full max-w-2xl"
          data-tour="home-search"
        >
          <GeneSearchShell searchGenes={searchGenes} />
        </HeroItem>
      </Hero>
      <HomeTour />
    </div>
  )
}

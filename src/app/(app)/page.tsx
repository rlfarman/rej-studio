import Link from 'next/link'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
import { searchGenes } from '@/features/gene-search/api/genes'
import { HelixMark } from '@/components/bio/helix-mark'
import { Hero, HeroItem, DnaFloat } from '@/app/_components/hero'
import { HomeTour } from '@/features/onboarding/components/home-tour'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'REJ Studio — RNA End-Joining sequence design',
  description:
    'Search genes, browse isoforms, and design optimized RNA End-Joining sequences — all in one tool.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'RNA End-Joining sequence design',
    description:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences.',
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
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <Hero>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <HeroItem index={0} className="mb-8 flex items-center justify-center">
            <DnaFloat className="helix-bob">
              <HelixMark className="h-20 w-auto sm:h-24" />
            </DnaFloat>
          </HeroItem>
          <HeroItem
            index={1}
            className="text-muted-foreground mb-6 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] uppercase"
          >
            <span
              aria-hidden
              className="from-border to-border/0 h-px w-8 bg-gradient-to-r"
            />
            RNA End-Joining&nbsp;·&nbsp;Studio
            <span
              aria-hidden
              className="from-border/0 to-border h-px w-8 bg-gradient-to-r"
            />
          </HeroItem>
          <HeroItem index={2} className="mb-5">
            <h1 className="font-display text-foreground text-[clamp(2.75rem,7vw,5.75rem)] leading-[0.95] tracking-tight text-balance">
              What gene are you{' '}
              <span className="font-display text-brand relative inline-block italic">
                optimizing
                <svg
                  aria-hidden="true"
                  viewBox="0 0 220 14"
                  preserveAspectRatio="none"
                  className="text-brand/70 pointer-events-none absolute inset-x-0 -bottom-1 h-2.5 w-full"
                >
                  <path
                    d="M2 8 C 60 2, 140 2, 218 8"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>
              ?
            </h1>
          </HeroItem>
          <HeroItem index={3}>
            <p
              className="text-muted-foreground max-w-md text-base sm:text-lg"
              data-tour="home-design-link"
            >
              Search a gene to browse isoforms, or{' '}
              <Link
                href={{
                  pathname: '/design-tool',
                  query: { gene: 'ATM' },
                }}
                className="text-foreground decoration-brand hover:decoration-brand/70 font-medium underline decoration-2 underline-offset-[6px] transition-colors"
              >
                design your own sequence
              </Link>
              .
            </p>
          </HeroItem>
        </div>
        <HeroItem
          index={4}
          className="mx-auto mt-10 w-full max-w-2xl px-4 sm:px-6 lg:px-8"
          data-tour="home-search"
        >
          <GeneSearch searchGenes={searchGenes} />
        </HeroItem>
      </Hero>
      <HomeTour />
    </div>
  )
}

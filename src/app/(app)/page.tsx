import Link from 'next/link'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
import { searchGenes } from '@/features/gene-search/api/genes'
import { Dna } from 'lucide-react'
import { Hero, HeroItem, DnaFloat } from '@/app/_components/hero'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'REJ Studio — RNA End-Joining sequence design',
  description:
    'Search genes, browse isoforms, and design optimized RNA End-Joining sequences — all in one tool.',
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <Hero>
        <div className="mx-auto mt-0 w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <HeroItem index={0} className="mb-4 flex items-center justify-center">
            <DnaFloat>
              <Dna className="mt-2 ml-2 size-6" />
            </DnaFloat>
          </HeroItem>
          <HeroItem index={1} className="pb-2 font-mono">
            RNA END-JOINING (REJ) Studio
          </HeroItem>
          <HeroItem index={2}>
            <h1 className="text-primary pb-2 text-3xl font-bold tracking-tight sm:text-4xl">
              What gene are you optimizing?
            </h1>
          </HeroItem>
          <HeroItem index={3}>
            <p className="text-muted-foreground">
              Try searching for a gene, or{' '}
              <Link
                href={{
                  pathname: '/design-tool',
                  query: { gene: 'ATM' },
                }}
                className="text-primary font-medium underline underline-offset-4"
              >
                design your own
              </Link>
              .
            </p>
          </HeroItem>
        </div>
        <HeroItem
          index={4}
          className="mx-auto mt-8 w-full max-w-2xl px-4 sm:px-6 lg:px-8"
        >
          <GeneSearch searchGenes={searchGenes} />
        </HeroItem>
      </Hero>
    </div>
  )
}

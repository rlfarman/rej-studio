import Link from 'next/link'
import { GeneSearch } from '@/components/gene-search'
import { searchGenes } from '@/actions/genes'
import { DnaIcon } from '@/components/dna-icon'
import { Hero, HeroItem, DnaFloat } from './_components/hero'

export default function HomePage() {
  return (
    <div className="flex flex-col lg:pt-36">
      <Hero>
        <div className="mx-auto mt-0 w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <HeroItem className="mb-4 flex items-center justify-center">
            <DnaFloat>
              <DnaIcon className="mt-2 ml-2 size-6" />
            </DnaFloat>
          </HeroItem>
          <HeroItem className="pb-2 font-mono">
            RNA END-JOINING (REJ) Studio
          </HeroItem>
          <HeroItem>
            <h1 className="text-primary pb-2 text-3xl font-bold tracking-tight sm:text-4xl">
              What gene are you optimizing?
            </h1>
          </HeroItem>
          <HeroItem>
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
        <HeroItem className="mx-auto mt-8 w-full max-w-2xl px-4 sm:px-6 lg:px-8">
          <GeneSearch searchGenes={searchGenes} />
        </HeroItem>
      </Hero>
    </div>
  )
}

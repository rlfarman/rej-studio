import Link from 'next/link'
import { GeneSearch } from '@/components/gene-search'
import { searchGenes } from '@/actions/genes'
import Image from 'next/image'

export default function HomePage() {
  return (
    <div className="flex flex-col lg:pt-36">
      <div className="mx-auto mt-0 w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div
          className="animate-fade-up mb-4 flex items-center justify-center"
          style={{ animationDelay: '0ms' }}
        >
          <Image
            src="/images/dna.svg"
            alt="REJ Studio Logo"
            width={24}
            height={24}
            className="animate-dna-float mt-2 ml-2 dark:invert"
          />
        </div>
        <div
          className="animate-fade-up pb-2 font-mono"
          style={{ animationDelay: '60ms' }}
        >
          RNA END-JOINING (REJ) Studio
        </div>
        <h1
          className="animate-fade-up text-primary pb-2 text-3xl font-bold sm:text-4xl"
          style={{ animationDelay: '120ms' }}
        >
          What gene are you optimizing?
        </h1>
        <p
          className="animate-fade-up text-muted-foreground"
          style={{ animationDelay: '180ms' }}
        >
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
      </div>
      <div
        className="animate-fade-up mx-auto mt-8 w-full max-w-2xl px-4 sm:px-6 lg:px-8"
        style={{ animationDelay: '240ms' }}
      >
        <GeneSearch searchGenes={searchGenes} />
      </div>
    </div>
  )
}

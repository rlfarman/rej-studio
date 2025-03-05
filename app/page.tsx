import Link from 'next/link'
import { GeneSearch } from './_components/gene-search'
import { searchGenes } from '@/actions'

export default function HomePage() {
  return (
    <div className="flex flex-col lg:pt-36">
      <div className="mx-auto mt-0 w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-center"></div>
        <div className="font-mono">RNA END JOINING</div>
        <h1 className="text-primary text-3xl font-bold sm:text-4xl">
          What gene are you optimizing?
        </h1>
        <p className="text-muted-foreground mt-3">
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
      <div className="mx-auto mt-8 w-full max-w-2xl px-4 sm:px-6 lg:px-8">
        <GeneSearch searchGenes={searchGenes} />
      </div>
    </div>
  )
}

import Link from 'next/link'
import GeneSearch from './(search)/_components/gene-search'
import { searchGenes } from '@/actions'

export default function HomePage() {
  return (
    <div className="flex flex-grow flex-col justify-center py-24 lg:py-32">
      <div className="mx-auto mt-0 w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-center"></div>
        <h1 className="text-primary text-3xl font-bold sm:text-4xl">
          What gene are you optimizing?
        </h1>
        <p className="text-muted-foreground mt-3">
          Try searching for a gene, or{' '}
          <Link
            href="/design-tool"
            className="text-sky-600 hover:underline dark:text-sky-500"
          >
            design your own
          </Link>
          .
        </p>
      </div>
      <div className="mx-auto mt-10 w-full max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="relative">
          <GeneSearch searchGenes={searchGenes} />
        </div>
      </div>
    </div>
  )
}

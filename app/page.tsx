import Link from 'next/link'
import GeneSearch from './_components/gene-search'

export default function Home() {
  return (
    <div>
      <p>
        Search for a gene by name or symbol, or{' '}
        <Link
          href="/design-tool"
          className="font-medium text-sky-600 hover:underline dark:text-sky-500"
        >
          design your own
        </Link>
      </p>
      <GeneSearch />
    </div>
  )
}

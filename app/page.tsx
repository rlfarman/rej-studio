import Link from 'next/link'
import GeneSearch from './_components/gene-search'

export default function Home() {
  return (
    <div>
      <p>
        Search for a sequence by gene or Ensemble Transcipt ID (ENST), or{' '}
        <Link
          href="/design-tool"
          className="font-medium text-sky-600 hover:underline dark:text-sky-500"
        >
          provide your own
        </Link>
      </p>
      <GeneSearch />
    </div>
  )
}

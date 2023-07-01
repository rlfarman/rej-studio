import GeneSplitterForm from '@/components/gene-splitter-form'
import Link from 'next/link'

function DesignToolPage() {
  return (
    <div>
      <span>
        Design your own, or{' '}
        <Link
          href="/"
          className="font-medium underline decoration-gray-500 dark:decoration-gray-400"
        >
          search for a gene
        </Link>
      </span>
      <hr className="my-8 h-px border-0 bg-gray-300 dark:bg-gray-700" />
      <div className="pt-4">
        <GeneSplitterForm />
      </div>
    </div>
  )
}

export default DesignToolPage

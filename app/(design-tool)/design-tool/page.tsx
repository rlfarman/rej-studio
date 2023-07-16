import GeneSplitterForm from '@/design-tool/components/gene-splitter-form'
import Link from 'next/link'

function DesignToolPage() {
  return (
    <div>
      <span>
        Provide your own sequence, or{' '}
        <Link
          href="/"
          className="font-medium text-sky-600 hover:underline dark:text-sky-500"
        >
          search by gene or Ensemble Transcript ID (ENST)
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

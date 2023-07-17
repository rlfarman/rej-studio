import Link from 'next/link'

interface DesignToolLayoutProperties {
  children: React.ReactNode
}

function DesignToolLayout({ children }: DesignToolLayoutProperties) {
  return (
    <div>
      <span>
        Design a custom sequence, or{' '}
        <Link
          href="/"
          className="font-medium text-sky-600 hover:underline dark:text-sky-500"
        >
          search by gene or Ensemble Transcript ID (ENST)
        </Link>
      </span>
      <hr className="my-8 h-px border-0 bg-neutral-300 dark:bg-neutral-700" />
      {children}
    </div>
  )
}

export default DesignToolLayout

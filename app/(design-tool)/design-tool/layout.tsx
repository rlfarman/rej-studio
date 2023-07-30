import Link from 'next/link'

interface DesignToolLayoutProperties {
  children: React.ReactNode
}

function DesignToolLayout({ children }: DesignToolLayoutProperties) {
  return (
    <div>
      <h2 className="text-2xl font-bold">Design a custom sequence</h2>
      <p className="mt-4 max-w-prose text-lg text-gray-500 dark:text-gray-400">
        You can design your own custom sequence using an arbitrary coding
        sequence.
      </p>
      <hr className="my-8 h-px border-0 bg-neutral-300 dark:bg-neutral-700" />
      {children}
    </div>
  )
}

export default DesignToolLayout

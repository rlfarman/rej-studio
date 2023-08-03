interface DesignToolLayoutProperties {
  children: React.ReactNode
}

function DesignToolLayout({ children }: DesignToolLayoutProperties) {
  return (
    <div>
      <h2 className="text-2xl font-bold">Design a custom sequence</h2>
      <p className="mt-2 max-w-prose text-lg text-neutral-500 dark:text-neutral-400">
        Design your RNA end-joining sequences with options for codon
        optimization and fragment suppression and stimulatory introns for
        5&apos; and 3&apos; sequences.
      </p>
      <hr className="my-8 h-px border-0 bg-neutral-300 dark:bg-neutral-700" />
      {children}
    </div>
  )
}

export default DesignToolLayout

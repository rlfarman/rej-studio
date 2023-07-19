import Link from 'next/link'

interface GeneSearchLayoutProperties {
  children: React.ReactNode
  params: {
    symbol: string
  }
}

export default function GeneSearchLayout({
  children,
}: GeneSearchLayoutProperties) {
  return (
    <section className="w-full">
      <p>
        Search for a sequence by gene or Ensemble Transcript ID (ENST), or{' '}
        <Link
          href="/design-tool"
          className="font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-500"
        >
          customize your own
        </Link>
      </p>
      {children}
    </section>
  )
}

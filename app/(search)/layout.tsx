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
      <h2 className="text-2xl font-bold">Find a known sequence</h2>
      <p className="mt-2 max-w-prose text-lg text-gray-500 dark:text-gray-400">
        You can find any known genetic sequence for humans and mice by searching
        for the symbol of the gene (ex: OBSCN), the name of the gene (ex:
        Obscurin), or an Ensembl Transcript ID (ENST, ex: ENST00000366704).
      </p>
      <div className="mt-2">{children}</div>
    </section>
  )
}

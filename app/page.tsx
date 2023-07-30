import GeneSearch from '@/search/components/gene-search'
import Button from '@/components/button'

export default function HomePage() {
  return (
    <div className="grid grid-cols-1 gap-y-16">
      <div>
        <h2 className="text-2xl font-bold">Start by finding your sequence</h2>
        <p className="mt-4 max-w-prose text-lg text-gray-500 dark:text-gray-400">
          You can find any known genetic sequence for humans and mice by
          searching for the symbol of the gene (ex: TP53), the name of the gene
          (ex: Tumor protein p53), or an Ensemble Transcript ID (ENST, ex:
          ENST00000450115).
        </p>
        <div className="mt-2">
          <GeneSearch />
        </div>
        <h2 className="mt-8 text-2xl font-bold">
          Or, design a custom sequence
        </h2>
        <p className="mt-4 max-w-prose text-lg text-gray-500 dark:text-gray-400">
          You can design your own custom sequence using an arbitrary coding
          sequence.
        </p>
        <div className="mt-2">
          <Button href="/design-tool">Design a custom sequence</Button>
        </div>
      </div>
    </div>
  )
}

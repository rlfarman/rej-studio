import GeneSearch from '@/search/components/gene-search'
import Button from '@/components/button'

export default function HomePage() {
  return (
    <div className="grid grid-cols-1 gap-y-16">
      <div>
        <h2 className="text-2xl font-bold">
          Start by finding a known sequence
        </h2>
        <p className="mt-2 max-w-prose text-lg text-gray-500 dark:text-gray-400">
          You can find any known genetic sequence for humans and mice by
          searching for the symbol of the gene (ex: OBSCN), the name of the gene
          (ex: Obscurin), or an Ensembl Transcript ID (ENST, ex:
          ENST00000366704).
        </p>
        <div className="mt-4">
          <GeneSearch />
        </div>
        <h2 className="mt-8 text-2xl font-bold">
          Or, design with your own sequence
        </h2>
        <p className="mt-2 max-w-prose text-lg text-gray-500 dark:text-gray-400">
          Design your RNA end-joining sequences with options for codon
          optimization, and fragment suppression and stimulatory introns for
          5&apos; and 3&apos; sequences.
        </p>
        <div className="mt-4">
          <Button href="/design-tool">Design with a custom sequence</Button>
        </div>
      </div>
    </div>
  )
}

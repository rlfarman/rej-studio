import type { Metadata } from 'next'
import type { Gene } from '@/types/gene'
import type { Isoform } from '@/types/isoform'
import { notFound } from 'next/navigation'
import GeneSplitterForm from '@/design-tool/components/gene-splitter-form'
import { loadCodingSequence } from '@/lib/genes'
import { SpeciesValues } from '@/design-tool/types/species-options'

interface DesignToolPageProperties {
  params: Promise<{
    ['gene-and-isoform']: `${Gene['symbol']}_${Isoform['ENST']}`
  }>
}

function parseParams(geneAndIsoform: string) {
  const underscoreIndex = geneAndIsoform.indexOf('_')
  if (underscoreIndex === -1) return null
  const symbol = geneAndIsoform.slice(0, underscoreIndex)
  const enst = geneAndIsoform.slice(underscoreIndex + 1)
  if (!symbol || !enst) return null
  return { symbol, enst }
}

function getSpeciesFromEnst(enst: string): SpeciesValues {
  if (enst.startsWith('ENST')) {
    return SpeciesValues.Human
  }
  if (enst.startsWith('ENSMUST')) {
    return SpeciesValues.Mouse
  }
  return SpeciesValues.None
}

export async function generateMetadata({
  params,
}: DesignToolPageProperties): Promise<Metadata> {
  const { 'gene-and-isoform': geneAndIsoform } = await params
  const parsed = parseParams(geneAndIsoform)
  if (!parsed) return { title: 'Design Tool' }
  return {
    title: `Design ${parsed.symbol} (${parsed.enst})`,
    description: `Generate codon-optimized RNA end-joining sequences for ${parsed.symbol} isoform ${parsed.enst}.`,
  }
}

export default async function DesignToolPage({
  params,
}: DesignToolPageProperties) {
  const { 'gene-and-isoform': geneAndIsoform } = await params
  const parsed = parseParams(geneAndIsoform)
  if (!parsed) notFound()
  const { symbol, enst } = parsed
  const defaultCodingSequence = loadCodingSequence(enst)
  const defaultSpecies = getSpeciesFromEnst(enst)
  return (
    <div className="mt-4">
      <GeneSplitterForm
        defaultName={symbol}
        defaultCodingSequence={defaultCodingSequence}
        defaultSpecies={defaultSpecies}
      />
    </div>
  )
}

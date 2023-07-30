import GeneSplitterForm from '@/design-tool/components/gene-splitter-form'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { SpeciesOptions } from '@/design-tool/types/species-options'

interface DesignToolPageProperties {
  params: { ['gene-and-isoform']: `${Gene['symbol']}_${Isoform['ENST']}` }
}

async function getData(enst: string): Promise<string | undefined> {
  try {
    const fileName = `${enst}.txt`
    const basePath = path.join(process.cwd(), 'public', 'data')
    const codingSequence = await fs.readFile(
      path.join(basePath, 'coding_sequences', fileName),
      'utf8'
    )
    return codingSequence
  } catch (error) {
    console.error(error)
    return ''
  }
}

function getSpeciesFromEnst(enst: string): SpeciesOptions {
  if (enst.startsWith('ENST')) {
    return SpeciesOptions.Human
  }
  if (enst.startsWith('ENSMUST')) {
    return SpeciesOptions.Mouse
  }
  return SpeciesOptions.All
}

export default async function DesignToolPage({
  params,
}: DesignToolPageProperties) {
  const [symbol, enst] = params['gene-and-isoform'].split('_')
  const defaultCodingSequence = enst ? await getData(enst) : ''
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

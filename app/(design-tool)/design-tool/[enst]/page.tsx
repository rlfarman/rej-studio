import GeneSplitterForm from '@/design-tool/components/gene-splitter-form'
import Link from 'next/link'
import path from 'node:path'
import { promises as fs } from 'node:fs'

const getData = async (enst: string): Promise<string | undefined> => {
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

export default async function DesignToolPage({
  params,
}: {
  params: { enst: string }
}) {
  const defaultCodingSequence = params.enst ? await getData(params.enst) : ''
  return (
    <div>
      <div className="pt-4">
        <GeneSplitterForm defaultCodingSequence={defaultCodingSequence} />
      </div>
    </div>
  )
}

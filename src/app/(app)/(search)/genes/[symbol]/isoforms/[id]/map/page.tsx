import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { buildGeneMapPayload } from '@/features/gene-map/api/gene-map-data'
import { GeneMap } from '@/features/gene-map/components/gene-map'

interface Props {
  params: Promise<{ symbol: string; id: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { symbol, id } = await props.params
  return {
    title: `${symbol} · Gene Map`,
    description: `Explorable sequence viewer for ${symbol} isoform ${id}.`,
    robots: { index: false },
  }
}

export default async function GeneMapPage(props: Props) {
  const { id } = await props.params
  const payload = await buildGeneMapPayload(id)
  if (!payload) notFound()
  return <GeneMap payload={payload} />
}

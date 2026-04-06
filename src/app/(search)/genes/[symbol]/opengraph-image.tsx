import { ImageResponse } from 'next/og'
import { getGeneBySymbol } from '@/features/gene-search/api/genes'
import { getIsoformsByGene } from '@/features/gene-search/api/isoforms'
import { parseSpeciesParam } from '@/lib/bio/species'

export const alt = 'Gene details'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>
  searchParams: Promise<{ species?: string }>
}) {
  const { symbol } = await params
  const { species } = await searchParams
  const gene = await getGeneBySymbol(symbol, parseSpeciesParam(species))

  if (!gene) {
    return new ImageResponse(
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#09090b',
          color: '#fafafa',
          fontSize: 48,
          fontFamily: 'monospace',
        }}
      >
        {symbol} — Gene not found
      </div>,
      size,
    )
  }

  const isoforms = await getIsoformsByGene(gene.id)
  const isoformCount = isoforms.length
  const species_ = [...new Set(isoforms.map((i) => i.species))]

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 80px',
        width: '100%',
        height: '100%',
        backgroundColor: '#09090b',
        color: '#fafafa',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            fontSize: 72,
            fontWeight: 700,
            fontFamily: 'monospace',
            letterSpacing: '-0.02em',
          }}
        >
          {gene.symbol}
        </span>
        <span style={{ fontSize: 24, color: '#a1a1aa' }}>
          {species_.join(' & ')}
        </span>
      </div>
      <div style={{ fontSize: 32, color: '#d4d4d8', marginBottom: '40px' }}>
        {gene.name}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '40px',
          fontSize: 24,
          color: '#a1a1aa',
        }}
      >
        <span>
          {isoformCount} isoform{isoformCount !== 1 ? 's' : ''}
        </span>
        <span>{gene.id}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          right: '80px',
          fontSize: 20,
          color: '#52525b',
        }}
      >
        REJ Studio
      </div>
    </div>,
    size,
  )
}

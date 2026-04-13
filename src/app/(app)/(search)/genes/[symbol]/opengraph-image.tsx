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
        justifyContent: 'space-between',
        padding: '72px 80px',
        width: '100%',
        height: '100%',
        backgroundColor: '#09090b',
        color: '#fafafa',
        fontFamily: 'system-ui, sans-serif',
        backgroundImage:
          'radial-gradient(circle at 85% 15%, rgba(56,189,248,0.12) 0%, transparent 55%), radial-gradient(circle at 15% 85%, rgba(168,85,247,0.10) 0%, transparent 55%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            color: '#d4d4d8',
            textTransform: 'uppercase',
          }}
        >
          REJ Studio
        </span>
        <span style={{ color: '#52525b', fontSize: 22 }}>/</span>
        <span
          style={{
            fontSize: 22,
            color: '#38bdf8',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Gene Search
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '20px',
          }}
        >
          <span
            style={{
              fontSize: 80,
              fontWeight: 700,
              fontFamily: 'monospace',
              letterSpacing: '-0.03em',
            }}
          >
            {gene.symbol}
          </span>
          <span style={{ fontSize: 28, color: '#a1a1aa' }}>
            {species_.join(' & ')}
          </span>
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#d4d4d8',
            lineHeight: 1.35,
            maxWidth: '90%',
          }}
        >
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
          <span style={{ color: '#52525b' }}>·</span>
          <span>{gene.id}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontFamily: 'monospace',
            color: '#71717a',
          }}
        >
          rejstudio.com/genes/{symbol.toLowerCase()}
        </span>
        <span
          style={{
            fontSize: 22,
            fontFamily: 'monospace',
            color: '#52525b',
            letterSpacing: '0.08em',
          }}
        >
          ATG · · · TAA
        </span>
      </div>
    </div>,
    size,
  )
}

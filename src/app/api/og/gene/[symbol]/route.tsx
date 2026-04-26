import { ImageResponse } from 'next/og'
import { readGeneBySymbol } from '@/lib/content/server'
import { parseSpeciesParam } from '@/lib/bio/species'
import {
  OG_ACCENT,
  OG_BG,
  OG_BORDER,
  OG_FG,
  OG_MUTED,
  OG_PRIMARY,
  loadDisplayFont,
  loadSansFont,
} from '@/lib/og-theme'

export const size = { width: 1200, height: 630 }

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await context.params
  const { searchParams } = new URL(request.url)
  const gene = await readGeneBySymbol(
    symbol,
    parseSpeciesParam(searchParams.get('species') ?? undefined),
  )
  const [displayFont, sansFont] = await Promise.all([
    loadDisplayFont(),
    loadSansFont(),
  ])

  if (!gene) {
    return new ImageResponse(
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: OG_BG,
          color: OG_FG,
          fontSize: 48,
          fontFamily: '"Source Sans 3", system-ui, sans-serif',
          fontWeight: 600,
        }}
      >
        {symbol} — Gene not found
      </div>,
      {
        ...size,
        fonts: [
          {
            name: 'Source Sans 3',
            data: sansFont,
            weight: 600,
            style: 'normal',
          },
        ],
      },
    )
  }

  const isoforms = gene.isoforms
  const isoformCount = isoforms.length
  const species = [...new Set(isoforms.map((i) => i.species))]

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        width: '100%',
        height: '100%',
        backgroundColor: OG_BG,
        color: OG_FG,
        fontFamily: '"Source Sans 3", system-ui, sans-serif',
        backgroundImage: `radial-gradient(circle at 85% 10%, ${OG_ACCENT}99 0%, transparent 55%), radial-gradient(circle at 10% 95%, ${OG_PRIMARY}26 0%, transparent 60%)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontFamily: '"Source Sans 3", system-ui, sans-serif',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: OG_MUTED,
            textTransform: 'uppercase',
          }}
        >
          REJ Studio
        </span>
        <span style={{ color: OG_BORDER, fontSize: 22 }}>/</span>
        <span
          style={{
            fontSize: 22,
            color: OG_PRIMARY,
            fontWeight: 600,
            letterSpacing: '0.1em',
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
              fontSize: 84,
              fontWeight: 700,
              fontFamily: '"Source Serif 4", serif',
              letterSpacing: '-0.02em',
              color: OG_FG,
            }}
          >
            {gene.symbol}
          </span>
          <span style={{ fontSize: 28, color: OG_MUTED }}>
            {species.join(' & ')}
          </span>
        </div>
        <div
          style={{
            fontSize: 36,
            fontFamily: '"Source Serif 4", serif',
            fontWeight: 700,
            color: OG_FG,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
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
            color: OG_MUTED,
          }}
        >
          <span>
            {isoformCount} isoform{isoformCount !== 1 ? 's' : ''}
          </span>
          <span style={{ color: OG_BORDER }}>·</span>
          <span>{gene.id}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${OG_BORDER}`,
          paddingTop: 24,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontFamily: '"Source Sans 3", system-ui, sans-serif',
            fontWeight: 600,
            color: OG_MUTED,
          }}
        >
          rejstudio.com/genes/{symbol.toLowerCase()}
        </span>
        <span
          style={{
            fontSize: 22,
            fontFamily: 'monospace',
            color: OG_PRIMARY,
            letterSpacing: '0.1em',
          }}
        >
          ATG · · · TAA
        </span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: 'Source Serif 4',
          data: displayFont,
          weight: 700,
          style: 'normal',
        },
        {
          name: 'Source Sans 3',
          data: sansFont,
          weight: 600,
          style: 'normal',
        },
      ],
      headers: {
        'Cache-Control':
          'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  )
}

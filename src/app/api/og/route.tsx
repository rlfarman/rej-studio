import { ImageResponse } from 'next/og'
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const title = searchParams.get('title') ?? 'REJ Studio'
  const description = searchParams.get('description') ?? ''
  const section = searchParams.get('section')
  const url = searchParams.get('url') ?? 'rejstudio.com'

  const [displayFont, sansFont] = await Promise.all([
    loadDisplayFont(),
    loadSansFont(),
  ])

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
        {section && (
          <>
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
              {section}
            </span>
          </>
        )}
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
            fontSize: 76,
            fontFamily: '"Source Serif 4", serif',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            color: OG_FG,
            maxWidth: '100%',
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: 28,
              color: OG_MUTED,
              lineHeight: 1.35,
              maxWidth: '90%',
            }}
          >
            {description}
          </div>
        )}
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
          {url}
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

import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const title = searchParams.get('title') ?? 'REJ Studio'
  const description = searchParams.get('description') ?? ''
  const section = searchParams.get('section')
  const url = searchParams.get('url') ?? 'rejstudio.com'

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
        {section && (
          <>
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
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: '#fafafa',
            maxWidth: '100%',
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: 28,
              color: '#a1a1aa',
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
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontFamily: 'monospace',
            color: '#71717a',
          }}
        >
          {url}
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
    {
      ...size,
      headers: {
        'Cache-Control':
          'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  )
}

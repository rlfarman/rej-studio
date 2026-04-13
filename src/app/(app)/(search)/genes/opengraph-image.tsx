import { ImageResponse } from 'next/og'

export const alt = 'Gene Search — REJ Studio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
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
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
          }}
        >
          Search by symbol,
          <br />
          name, or disease
        </div>
        <div
          style={{
            display: 'flex',
            gap: '24px',
            fontSize: 24,
            color: '#a1a1aa',
          }}
        >
          <span>Human &amp; Mouse</span>
          <span style={{ color: '#52525b' }}>·</span>
          <span>Full-text search</span>
          <span style={{ color: '#52525b' }}>·</span>
          <span>Pre-optimized sequences</span>
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
          rejstudio.com/genes
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

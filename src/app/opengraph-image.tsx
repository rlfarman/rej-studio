import { ImageResponse } from 'next/og'

export const alt = 'REJ Studio — RNA End-Joining made easy'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#09090b',
        color: '#fafafa',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontFamily: 'monospace',
          color: '#a1a1aa',
          marginBottom: '16px',
          letterSpacing: '0.1em',
        }}
      >
        &#x1F9EC;
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          fontFamily: 'monospace',
          letterSpacing: '-0.02em',
          marginBottom: '16px',
        }}
      >
        REJ Studio
      </div>
      <div
        style={{
          fontSize: 28,
          color: '#d4d4d8',
          marginBottom: '40px',
        }}
      >
        RNA End-Joining sequence design
      </div>
      <div
        style={{
          display: 'flex',
          gap: '32px',
          fontSize: 20,
          color: '#a1a1aa',
        }}
      >
        <span>Search genes</span>
        <span style={{ color: '#52525b' }}>·</span>
        <span>Browse isoforms</span>
        <span style={{ color: '#52525b' }}>·</span>
        <span>Optimize sequences</span>
      </div>
    </div>,
    size,
  )
}

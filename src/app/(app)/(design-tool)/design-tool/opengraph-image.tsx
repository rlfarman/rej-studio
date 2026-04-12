import { ImageResponse } from 'next/og'

export const alt = 'Design Tool — REJ Studio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
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
          fontSize: 64,
          fontWeight: 700,
          fontFamily: 'monospace',
          letterSpacing: '-0.02em',
          marginBottom: '16px',
        }}
      >
        Design Tool
      </div>
      <div style={{ fontSize: 28, color: '#d4d4d8', marginBottom: '40px' }}>
        Optimize coding sequences for RNA End-Joining
      </div>
      <div
        style={{
          display: 'flex',
          gap: '24px',
          fontSize: 22,
          color: '#a1a1aa',
        }}
      >
        <span>Custom CDS input</span>
        <span style={{ color: '#52525b' }}>·</span>
        <span>DNAChisel optimization</span>
        <span style={{ color: '#52525b' }}>·</span>
        <span>Downloadable results</span>
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

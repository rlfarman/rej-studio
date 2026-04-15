import { ImageResponse } from 'next/og'
import { dnaIconSvg } from '@/lib/dna-icon-svg'
import { OG_BG } from '@/lib/og-theme'

const MIN_SIZE = 16
const MAX_SIZE = 1024

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = Number(searchParams.get('size') ?? 512)
  const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(raw)))
  const imgSize = Math.round(size * 0.7)
  const radius = Math.round(size * 0.2)

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: OG_BG,
        borderRadius: radius,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dnaIconSvg} alt="" width={imgSize} height={imgSize} />
    </div>,
    {
      width: size,
      height: size,
      headers: {
        'Cache-Control':
          'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    },
  )
}

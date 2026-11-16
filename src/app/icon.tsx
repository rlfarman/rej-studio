import { ImageResponse } from 'next/og'
import { dnaIconSvg } from '@/lib/dna-icon-svg'
import { OG_BG } from '@/lib/og-theme'

// One icon file, three sizes: the 32px favicon plus the 192/512 sizes the
// web app manifest lists (src/app/manifest.ts). Each is served at
// /icon/<id>, which the proxy keeps public so browsers and the OS can fetch
// it without a session.
const ICON_SIZES = [32, 192, 512] as const

export function generateImageMetadata() {
  return ICON_SIZES.map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: 'image/png',
  }))
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const px = Number(await id)
  const glyph = Math.round(px * 0.7)

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: OG_BG,
        borderRadius: Math.round(px * 0.2),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
      <img src={dnaIconSvg} alt="" width={glyph} height={glyph} />
    </div>,
    { width: px, height: px },
  )
}

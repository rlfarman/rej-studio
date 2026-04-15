import { ImageResponse } from 'next/og'
import { dnaIconSvg } from '@/lib/dna-icon-svg'
import { OG_BG } from '@/lib/og-theme'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: OG_BG,
        borderRadius: 6,
      }}
    >
      {}
      <img src={dnaIconSvg} alt="" width={22} height={22} />
    </div>,
    { ...size },
  )
}

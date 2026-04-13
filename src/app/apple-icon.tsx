import { ImageResponse } from 'next/og'
import { dnaIconSvg } from '@/lib/dna-icon-svg'

export const size = { width: 180, height: 180 }
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
        background: '#09090b',
        borderRadius: 36,
      }}
    >
      {}
      <img src={dnaIconSvg} alt="" width={120} height={120} />
    </div>,
    { ...size },
  )
}

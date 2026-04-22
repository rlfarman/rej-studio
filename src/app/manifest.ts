import type { MetadataRoute } from 'next'
import { OG_BG, OG_BRAND } from '@/lib/og-theme'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'REJ Studio',
    short_name: 'REJ Studio',
    description:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences.',
    start_url: '/genes',
    display: 'standalone',
    background_color: OG_BG,
    theme_color: OG_BRAND,
    icons: [
      {
        src: '/api/icon?size=192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/api/icon?size=512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

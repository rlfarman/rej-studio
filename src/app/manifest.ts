import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'REJ Studio',
    short_name: 'REJ Studio',
    description:
      'Search genes, browse isoforms, and design optimized RNA End-Joining sequences.',
    start_url: '/genes',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#0EA5E9',
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

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
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
    ],
  }
}

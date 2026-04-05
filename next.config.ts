import type { NextConfig } from 'next'
import path from 'path'

// In development, proxy /api/py/* to the local uvicorn dev server.
// In production, the Python backend runs on Modal and is called directly from
// server actions (see src/features/design-tool/api/jobs.ts) — no rewrites.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  rewrites: async () => {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/py/:path*',
          destination: 'http://127.0.0.1:8000/api/py/:path*',
        },
        {
          source: '/docs',
          destination: 'http://127.0.0.1:8000/api/py/docs',
        },
        {
          source: '/openapi.json',
          destination: 'http://127.0.0.1:8000/api/py/openapi.json',
        },
      ]
    }

    return []
  },
}

export default nextConfig

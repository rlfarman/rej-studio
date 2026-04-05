import type { NextConfig } from 'next'
import path from 'path'

// DEPLOY_TARGET selects the deployment-specific config. Defaults to `vercel`.
//   - vercel:    rewrites /api/py/* to the FastAPI Python function in /api/
//   - cloudflare: no rewrites (no Python runtime on Workers; compute runs via Modal)
const DEPLOY_TARGET = (process.env.DEPLOY_TARGET ?? 'vercel').toLowerCase()
const isVercel = DEPLOY_TARGET === 'vercel'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  rewrites: async () => {
    // In dev, always proxy to local uvicorn regardless of target.
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

    // Production rewrites only make sense on Vercel, where /api/ is a Python
    // serverless function. Cloudflare has no Python runtime — requests go
    // direct to Modal via the server actions in features/design-tool/api/.
    if (isVercel) {
      return [
        {
          source: '/api/py/:path*',
          destination: '/api/',
        },
        {
          source: '/docs',
          destination: '/api/py/docs',
        },
        {
          source: '/openapi.json',
          destination: '/api/py/openapi.json',
        },
      ]
    }

    return []
  },
}

export default nextConfig

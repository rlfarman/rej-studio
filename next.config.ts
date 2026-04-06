import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'
import path from 'path'
import withBundleAnalyzer from '@next/bundle-analyzer'

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

// In development, proxy /api/py/* to the local uvicorn dev server.
// In production, the Python backend runs on Modal and is called directly from
// server actions (see src/features/design-tool/api/jobs.ts) — no rewrites.
const nextConfig: NextConfig = {
  // Emit standalone output for Docker production builds (see docker/prod.Dockerfile).
  // Gated behind DOCKER_BUILD to avoid changing Vercel/CF deploy behavior.
  ...(process.env.DOCKER_BUILD === 'true' && { output: 'standalone' }),
  cacheComponents: true,
  // PGlite uses native/WASM modules that must not be bundled by webpack/turbopack.
  serverExternalPackages: ['@electric-sql/pglite'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  env: {
    // Baked at build-time so /api/version can report exactly which deploy is
    // running. Vercel sets VERCEL_GIT_COMMIT_SHA automatically; for CF/self-
    // host, pass GIT_COMMIT_SHA in the build command.
    GIT_COMMIT_SHA:
      process.env.GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      'unknown',
    BUILD_TIMESTAMP: new Date().toISOString(),
  },
  headers: async () => [
    // Stale-while-revalidate for sitemap and OG images — CDN serves the
    // cached version instantly and revalidates in the background.
    {
      source: '/sitemap.xml',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      ],
    },
    {
      source: '/genes/:symbol/opengraph-image',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      ],
    },
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'X-Permitted-Cross-Domain-Policies',
          value: 'none',
        },
        // CSP is set per-request in proxy.ts with a unique nonce.
        // Do not add a static CSP header here — it would conflict.
      ],
    },
  ],
  rewrites: async () => {
    if (process.env.NODE_ENV === 'development') {
      // LOCAL_API_URL defaults to localhost; in Docker it points to the
      // fastapi service (e.g. http://fastapi:8000).
      const pyBackend = process.env.LOCAL_API_URL ?? 'http://127.0.0.1:8000'
      return [
        {
          source: '/api/py/:path*',
          destination: `${pyBackend}/api/py/:path*`,
        },
        {
          source: '/docs',
          destination: `${pyBackend}/api/py/docs`,
        },
        {
          source: '/openapi.json',
          destination: `${pyBackend}/api/py/openapi.json`,
        },
      ]
    }

    return []
  },
}

// Sentry wrapping — only active when NEXT_PUBLIC_SENTRY_DSN is set.
// In dev / CI without the DSN, this is a no-op pass-through.
const sentryWrapped = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(bundleAnalyzer(nextConfig), {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: '/monitoring',
      webpack: {
        treeshake: { removeDebugLogging: true },
        automaticVercelMonitors: true,
      },
    })
  : bundleAnalyzer(nextConfig)

export default sentryWrapped

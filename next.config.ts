import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'
import path from 'path'

// In development, proxy /api/py/* to the local uvicorn dev server.
// In production, the Python backend runs on Modal and is called directly from
// server actions (see src/features/design-tool/api/jobs.ts) — no rewrites.
const nextConfig: NextConfig = {
  cacheComponents: true,
  // Prefetch one reusable App Shell per route instead of one prefetch per
  // visible link. Requires cacheComponents; becomes the default in Next 17.
  partialPrefetching: true,
  // React Compiler 1.0 (stable since Next 16): automatic memoization, so
  // components don't need hand-written useMemo/useCallback. Uses the stable
  // Babel plugin; Next only applies it to files with JSX or hooks. The Rust
  // port (experimental.turbopackRustReactCompiler) is still experimental.
  reactCompiler: true,
  experimental: {
    // lucide-react is already in Next's built-in list.
    optimizePackageImports: ['@tanstack/react-query', 'react-hook-form'],
  },
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
    // Stale-while-revalidate for the sitemap — CDN serves the cached version
    // instantly and revalidates in the background. (OG image routes set
    // their own Cache-Control in their ImageResponse.)
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
        // The Content-Security-Policy is set in proxy.ts (production only).
        // Don't add one here: browsers enforce every CSP header they get.
      ],
    },
  ],
  redirects: async () => [
    // `/index` was served the `/` page shell but rendered with its own path,
    // so React fell back to client rendering (Sentry REJ-STUDIO-2D).
    { source: '/index', destination: '/', permanent: true },
  ],
  rewrites: async () => {
    if (process.env.NODE_ENV === 'development') {
      // LOCAL_API_URL overrides where uvicorn listens (default localhost).
      const pyBackend = process.env.LOCAL_API_URL ?? 'http://127.0.0.1:8000'
      return [
        {
          source: '/api/py/:path*',
          destination: `${pyBackend}/api/py/:path*`,
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
  ? withSentryConfig(nextConfig, {
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
  : nextConfig

export default sentryWrapped

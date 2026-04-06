import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { withCors } from '@/lib/api-cors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Lightweight version endpoint. Returns the commit SHA and build timestamp
 * so we can correlate "which deploy is throwing this error" without digging
 * through Vercel/CF dashboards.
 *
 * GIT_COMMIT_SHA and BUILD_TIMESTAMP are injected at build time via
 * next.config.ts → env block, or fall back to process.env (set by Vercel
 * automatically as VERCEL_GIT_COMMIT_SHA).
 */
export async function GET() {
  const hdrs = await headers()
  const origin = hdrs.get('origin')

  return withCors(
    NextResponse.json(
      {
        version: process.env.npm_package_version ?? 'unknown',
        sha:
          process.env.GIT_COMMIT_SHA ??
          process.env.VERCEL_GIT_COMMIT_SHA ??
          'unknown',
        buildTimestamp: process.env.BUILD_TIMESTAMP ?? 'unknown',
        nodeEnv: process.env.NODE_ENV,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    ),
    origin,
  )
}

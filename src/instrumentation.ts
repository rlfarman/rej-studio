/**
 * Next.js instrumentation hook — runs once on server startup before any
 * route handler or middleware fires.
 *
 * Two jobs:
 *   1. Force env validation (via @/lib/env import) so a misconfigured
 *      deployment blows up immediately instead of on the first user request.
 *   2. Wire up Sentry (when NEXT_PUBLIC_SENTRY_DSN is set) for errors and
 *      traces. Sentry registers its own OpenTelemetry tracer provider, so
 *      there's no separate OTel SDK here: a second provider would receive no
 *      spans once Sentry's took the global slot.
 */
export async function register() {
  // Side-effect import: env.ts throws on validation failure at module load.
  // Pulling it in here guarantees the app crashes at boot if env vars are
  // wrong — not silently on the first request.
  await import('@/lib/env')

  // Sentry server-side init. The browser SDK is initialized in
  // instrumentation-client.ts, which Next loads on the client.
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./sentry.server.config')
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('./sentry.edge.config')
    }
  }

  // Flush Sentry on shutdown
  if (
    process.env.NEXT_PUBLIC_SENTRY_DSN &&
    process.env.NEXT_RUNTIME === 'nodejs'
  ) {
    const Sentry = await import('@sentry/nextjs')
    process.on('SIGTERM', () => {
      Sentry.close(2000).catch(console.error)
    })
  }
}

export async function onRequestError(
  err: { digest: string } & Error,
  request: {
    path: string
    method: string
    headers: { [key: string]: string | undefined }
  },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  const { captureRequestError } = await import('@sentry/nextjs')
  captureRequestError(err, request, context)
}

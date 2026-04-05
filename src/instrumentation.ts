/**
 * Next.js instrumentation hook — runs once on server startup before any
 * route handler or middleware fires.
 *
 * Two jobs:
 *   1. Force env validation (via @/lib/env import) so a misconfigured
 *      deployment blows up immediately instead of on the first user request.
 *   2. Wire up OpenTelemetry (when an OTLP endpoint is configured) so
 *      per-route latency, Neon query timings, and Modal call durations are
 *      shipped to whatever collector is plugged in (Axiom, Grafana, etc.).
 */
export async function register() {
  // Side-effect import: env.ts throws on validation failure at module load.
  // Pulling it in here guarantees the app crashes at boot if env vars are
  // wrong — not silently on the first request.
  await import('@/lib/env')

  // OpenTelemetry auto-instrumentation for Next.js
  // Enabled when OTEL_EXPORTER_OTLP_ENDPOINT is set (e.g. Axiom, Grafana).
  // Uses @vercel/otel if available (it's a thin wrapper); otherwise skips.
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    try {
      // @ts-expect-error — @vercel/otel is an optional peer dep; only
      // loaded when OTEL_EXPORTER_OTLP_ENDPOINT is configured.
      const { registerOTel } = await import('@vercel/otel')
      registerOTel({
        serviceName: process.env.OTEL_SERVICE_NAME ?? 'rej-studio',
      })
    } catch {
      // @vercel/otel not installed — skip silently. OTel is opt-in.
      console.info(
        'OTEL_EXPORTER_OTLP_ENDPOINT is set but @vercel/otel is not installed. Skipping OpenTelemetry.',
      )
    }
  }
}

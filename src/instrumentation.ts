/**
 * Next.js instrumentation hook — runs once on server startup before any
 * route handler or middleware fires.
 *
 * Three jobs:
 *   1. Force env validation (via @/lib/env import) so a misconfigured
 *      deployment blows up immediately instead of on the first user request.
 *   2. Wire up Sentry (when NEXT_PUBLIC_SENTRY_DSN is set) for error tracking.
 *   3. Wire up OpenTelemetry (when an OTLP endpoint is configured) so
 *      per-route latency, Neon query timings, and Modal call durations are
 *      shipped to whatever collector is plugged in (Axiom, Grafana, etc.).
 *      Uses the vendor-neutral OpenTelemetry SDK directly — no Vercel lock-in.
 */
export async function register() {
  // Side-effect import: env.ts throws on validation failure at module load.
  // Pulling it in here guarantees the app crashes at boot if env vars are
  // wrong — not silently on the first request.
  await import('@/lib/env')

  // Sentry server-side init. The client config is loaded automatically by
  // @sentry/nextjs via sentry.client.config.ts.
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./sentry.server.config')
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('./sentry.edge.config')
    }
  }

  // OpenTelemetry — vendor-neutral setup using the standard SDK.
  // Enabled when OTEL_EXPORTER_OTLP_ENDPOINT is set (e.g. Axiom, Grafana,
  // Honeycomb). Next.js automatically creates spans for routes, server
  // actions, and fetches when the SDK is active.
  //
  // Ships traces, metrics, and logs over OTLP/HTTP to whatever collector is
  // configured. Axiom example:
  //   OTEL_EXPORTER_OTLP_ENDPOINT=https://api.axiom.co
  //   OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>,X-Axiom-Dataset=<dataset>
  if (
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT &&
    process.env.NEXT_RUNTIME === 'nodejs'
  ) {
    const { NodeSDK } = await import('@opentelemetry/sdk-node')
    const { OTLPTraceExporter } =
      await import('@opentelemetry/exporter-trace-otlp-http')
    const { OTLPLogExporter } =
      await import('@opentelemetry/exporter-logs-otlp-http')
    const { OTLPMetricExporter } =
      await import('@opentelemetry/exporter-metrics-otlp-http')
    const { getNodeAutoInstrumentations } =
      await import('@opentelemetry/auto-instrumentations-node')
    const { ATTR_SERVICE_NAME } =
      await import('@opentelemetry/semantic-conventions')
    const { resourceFromAttributes } = await import('@opentelemetry/resources')
    const { SimpleLogRecordProcessor } = await import('@opentelemetry/sdk-logs')
    const { PeriodicExportingMetricReader } =
      await import('@opentelemetry/sdk-metrics')

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'rej-studio',
      }),
      traceExporter: new OTLPTraceExporter(),
      logRecordProcessors: [
        new SimpleLogRecordProcessor(new OTLPLogExporter()),
      ],
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: 60_000,
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    })

    sdk.start()

    // Flush pending spans/logs/metrics on graceful shutdown so telemetry
    // isn't lost when the process exits (container stop, deploy, etc.).
    process.on('SIGTERM', () => {
      sdk.shutdown().catch(console.error)
    })
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

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only initialise when a DSN is configured — keeps local dev silent.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions in production to stay within free-tier limits.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Replay is expensive — sample lightly for general sessions, more for errors.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.5,

  integrations: [Sentry.replayIntegration()],
})

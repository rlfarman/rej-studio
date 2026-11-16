import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // No Session Replay: little value for a small lab tool. Errors and traces
  // still report. (The SDK still bundles the replay code; dropping it needs
  // a build-level fix.)

  // Sentry 11 replaced `sendDefaultPii: true` with `dataCollection`, whose
  // defaults already collect user info, cookies, headers and query params
  // (with sensitive values filtered), so no option is needed here.
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

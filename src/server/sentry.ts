/**
 * Sentry options for the Worker (`@sentry/cloudflare`).
 *
 * `withSentry` takes a callback rather than an object because the DSN comes
 * from the request's environment: it lives in wrangler.jsonc as a plain
 * `vars` entry, not a secret, since a DSN is public (it is in the client
 * bundle too). The callback runs per invocation, so this is kept cheap.
 *
 * Its own module so the options can be asserted in a unit test without
 * importing the Worker entry, which pulls in Start's whole server handler.
 */

import type { CloudflareOptions } from '@sentry/cloudflare'

import type { ServerEnv } from './env'

export function sentryOptions(env: ServerEnv): CloudflareOptions {
  const dsn = env.SENTRY_DSN?.trim()
  return {
    dsn,
    // Without the var there is nothing to send to, so the client is off
    // rather than merely silent: local `vp dev`, `vp preview`, the worker
    // smoke test and CI never touch the network.
    enabled: Boolean(dsn),
    // Modest and deliberate, matching the browser (src/lib/sentry.ts): every
    // error, a tenth of requests traced. The Worker's traffic is the server
    // routes, the MCP endpoint and cloud designs — low volume, but an MCP
    // design can burn minutes of CPU, so a sample is enough to see it.
    tracesSampleRate: 0.1,
    // Designs are the user's unpublished research. A cloud design and an MCP
    // `submit_design` both carry a coding sequence in the request body, and
    // the SDK would otherwise attach it to the event.
    dataCollection: {
      httpBodies: [],
      // The passcode gate has no per-person identity, and the session cookie
      // and bearer tokens must never be reported.
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      urlQueryParams: false,
      stackFrameVariables: false,
    },
  }
}

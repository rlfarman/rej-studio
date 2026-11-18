// @vitest-environment node
import { describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

/** Start's handler, which plain Vitest cannot load (only its compiler can). */
const { startFetch } = vi.hoisted(() => ({
  startFetch: vi.fn(() => Response.json({ status: 'ok' })),
}))
vi.mock('@tanstack/react-start/server-entry', () => ({
  default: { fetch: startFetch },
}))
/** Pulls in `cloudflare:workers`; the Workflow itself is covered elsewhere. */
vi.mock('./designs/workflow', () => ({
  DesignWorkflow: class DesignWorkflow {},
}))

import type { ServerEnv } from './env'
import { sentryOptions } from './sentry'
import workerEntry, { DesignWorkflow } from './worker-entry'

const SITE = 'https://rej.example.com'
const GATE: ServerEnv = {
  BASIC_AUTH_PASSWORD: 'splice',
  SESSION_SECRET: 'a-session-secret-that-is-at-least-32-chars',
}

/**
 * The entry's own `fetch` declares only (request, env) — the runtime always
 * passes the execution context as well, and Sentry's wrapper reads it.
 */
const workerFetch = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> =>
  (
    workerEntry.fetch as (
      this: void,
      request: Request,
      env: Env,
      ctx: ExecutionContext,
    ) => Promise<Response>
  )(request, env, ctx)

function context(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as unknown as ExecutionContext
}

describe('the Worker’s Sentry options', () => {
  it('is off, not merely silent, without SENTRY_DSN', () => {
    const options = sentryOptions({})
    expect(options.dsn).toBeUndefined()
    expect(options.enabled).toBe(false)
  })

  it('is on with the DSN from the request environment', () => {
    const options = sentryOptions({ SENTRY_DSN: 'https://k@o1.example/42' })
    expect(options.dsn).toBe('https://k@o1.example/42')
    expect(options.enabled).toBe(true)
  })

  it('treats a blank var as unset, so `--var SENTRY_DSN:` turns it off', () => {
    expect(sentryOptions({ SENTRY_DSN: '  ' }).enabled).toBe(false)
  })

  it('sends no request bodies, cookies, headers or user identity', () => {
    // Designs are the user's unpublished research: a cloud design and an MCP
    // submit_design both carry a coding sequence in the request body.
    const { dataCollection } = sentryOptions({ SENTRY_DSN: 'https://k@o/1' })
    expect(dataCollection?.httpBodies).toEqual([])
    expect(dataCollection?.userInfo).toBe(false)
    expect(dataCollection?.cookies).toBe(false)
    expect(dataCollection?.httpHeaders).toBe(false)
    expect(dataCollection?.urlQueryParams).toBe(false)
    expect(dataCollection?.stackFrameVariables).toBe(false)
  })

  it('samples traces modestly rather than capturing every request', () => {
    const rate = sentryOptions({ SENTRY_DSN: 'https://k@o/1' }).tracesSampleRate
    expect(rate).toBeGreaterThan(0)
    expect(rate).toBeLessThanOrEqual(0.25)
  })
})

describe('the Worker, wrapped in Sentry', () => {
  it('answers a route normally with no DSN set', async () => {
    const response = await workerFetch(
      new Request(`${SITE}/api/health`),
      GATE as Env,
      context(),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
    expect(startFetch).toHaveBeenCalled()
  })

  it('still runs the passcode gate before Start’s handler', async () => {
    startFetch.mockClear()
    const response = await workerFetch(
      new Request(`${SITE}/_serverFn/designs`, { method: 'POST' }),
      GATE as Env,
      context(),
    )
    expect(response.status).toBe(401)
    expect(startFetch).not.toHaveBeenCalled()
  })

  it('keeps the Workflow a named export of the main module', () => {
    // Cloudflare looks the class up by name on the Worker's main module, so
    // wrapping the default export must not move or rename it.
    expect(typeof DesignWorkflow).toBe('function')
  })
})

import { describe, expect, it, vi } from 'vite-plus/test'

/**
 * `VITE_SENTRY_DSN` is unset under Vitest, which is the case worth holding:
 * with no DSN the module must not load `@sentry/react` at all, so local dev,
 * CI and Storybook stay silent and never fetch the SDK's chunk.
 */
const sentryModule = vi.hoisted(() => ({ loaded: false }))
vi.mock('@sentry/react', () => {
  sentryModule.loaded = true
  return {
    init: vi.fn(),
    captureException: vi.fn(),
    tanstackRouterBrowserTracingIntegration: vi.fn(),
  }
})

import { initBrowserSentry, publishRouterToSentry, reportError } from './sentry'

describe('the browser SDK, with no VITE_SENTRY_DSN', () => {
  it('loads nothing when it is started', async () => {
    expect(import.meta.env.VITE_SENTRY_DSN).toBeUndefined()
    initBrowserSentry()
    publishRouterToSentry({})
    await Promise.resolve()
    expect(sentryModule.loaded).toBe(false)
  })

  it('swallows a report rather than throwing or loading the SDK', async () => {
    expect(() => {
      reportError(new Error('boom'), { boundary: 'route' })
    }).not.toThrow()
    await Promise.resolve()
    expect(sentryModule.loaded).toBe(false)
  })
})

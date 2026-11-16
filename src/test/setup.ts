/**
 * Shared test setup — auto-loaded by vitest via setupFiles.
 *
 * Mocks Next.js server APIs and analytics so tests can import server
 * actions and hooks without hitting real infrastructure.
 */
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
// happy-dom has no IndexedDB, which the design history is stored in. This
// installs an in-memory implementation on the globals.
import 'fake-indexeddb/auto'

// Testing Library only registers its automatic cleanup when test globals are
// enabled, and they're off in vitest.config.ts. Without this, hooks and
// components from earlier tests stay mounted, and their debounced queries
// fire into later tests' shared mocks (flaky on slower CI runners).
afterEach(() => {
  cleanup()
})

// --- next/headers ---
// Server actions call headers() to extract IP for rate limiting, and
// cookies() to check the session when the auth gate is on. The default
// cookie store is empty; tests that need a session override cookies().
const mockHeaders = new Headers({ 'x-forwarded-for': '127.0.0.1' })
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeaders),
  cookies: vi.fn(async () => ({ get: () => undefined })),
}))

// --- next/cache ---
// Query functions use `cacheLife()` which is a no-op outside Next.js.
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

// --- Analytics ---
// trackEvent pushes to window.dataLayer; mock it to prevent side effects.
vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))
vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))

// --- Logger ---
// Silence structured logs in tests.
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

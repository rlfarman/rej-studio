/**
 * Shared test setup — auto-loaded by vitest via setupFiles.
 *
 * Mocks Next.js server APIs and analytics so tests can import server
 * actions and hooks without hitting real infrastructure.
 */
import { vi } from 'vitest'

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

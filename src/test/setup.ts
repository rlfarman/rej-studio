/**
 * Shared test setup — auto-loaded by vitest via setupFiles.
 *
 * Mocks analytics and the logger so tests stay quiet and side-effect free.
 */
import { afterEach, vi } from 'vite-plus/test'
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

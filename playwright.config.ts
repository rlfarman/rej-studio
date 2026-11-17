import { defineConfig, devices } from '@playwright/test'
import { E2E_PORT } from './e2e/constants'

const baseURL = `http://localhost:${E2E_PORT}`

/**
 * Browser smoke tests (`pnpm test:e2e`).
 *
 * Runs against the TanStack Start dev server (`vp dev`, the Worker in
 * workerd). `E2E_SERVER=preview` runs the same specs against `vp preview`
 * instead, i.e. the production build on workerd; build first.
 *
 * Port 3000 (`strictPort` in vite.config.ts): stop a local `pnpm dev` first.
 */
const server =
  process.env.E2E_SERVER === 'preview'
    ? `pnpm exec vp preview --port ${E2E_PORT}`
    : `pnpm exec vp dev --port ${E2E_PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // First visits compile modules on demand in dev mode.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'app',
      testIgnore: /browser-optimizer\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Designing a real gene in WebAssembly takes longer than a page load,
      // hence the raised timeout.
      name: 'browser-optimizer',
      testMatch: /browser-optimizer\.spec\.ts/,
      timeout: 180_000,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: server,
    // The local stand-in for a Cloudflare Access sign-in, so cloud designs
    // (cloud-design.spec.ts) have an owner. The Cloudflare plugin passes the
    // process environment to the Worker only with this flag and only when
    // there is no .dev.vars, which is the case in CI and a fresh worktree;
    // src/server/designs/access.ts honours it on localhost only.
    env: {
      CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
      DEV_ACCESS_EMAIL: 'e2e@example.com',
    },
    url: `${baseURL}/favicon.svg`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})

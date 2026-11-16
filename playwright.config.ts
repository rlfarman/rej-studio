import { defineConfig, devices } from '@playwright/test'
import {
  E2E_PASSWORD,
  E2E_PORT,
  E2E_SESSION_SECRET,
  STORAGE_STATE,
} from './e2e/constants'

const baseURL = `http://localhost:${E2E_PORT}`

/**
 * Browser smoke tests (`pnpm test:e2e`).
 *
 * Runs against `next dev` with the in-memory PGlite sample data
 * (production mode insists on a real Postgres) and with the password gate
 * on, so one server covers both the gate and the signed-in pages.
 *
 * Port 3000 because the dev-mode CSRF allowlist (src/lib/allowed-origins.ts)
 * only accepts that localhost port for the login form's POST. Stop a local
 * `pnpm dev` before running this.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // First visits compile routes on demand in dev mode.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'signed-out',
      testMatch: /gate\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'signed-in',
      testMatch: /smoke\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
    },
    {
      // The in-browser optimizer is off by default, so this project turns it
      // on for its own server. Designing a real gene in WebAssembly takes
      // longer than a page load, hence the raised timeout.
      name: 'browser-optimizer',
      testMatch: /browser-optimizer\.spec\.ts/,
      dependencies: ['setup'],
      timeout: 180_000,
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${E2E_PORT}`,
    url: `${baseURL}/robots.txt`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      DATABASE_URL: 'memory://',
      BASIC_AUTH_PASSWORD: E2E_PASSWORD,
      SESSION_SECRET: E2E_SESSION_SECRET,
      // browser-optimizer.spec.ts needs this on; the other projects assert
      // the default backend path, which this does not change for them
      // because they never submit a design.
      NEXT_PUBLIC_ENABLE_BROWSER_OPTIMIZER: 'true',
    },
  },
})

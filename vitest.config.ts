import { defineConfig } from 'vite-plus'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

// Separate from vite.config.ts on purpose: Vitest can't load the Cloudflare
// plugin there (Cloudflare's Start migration guide says the same), and tests
// need none of the app's plugins.
export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      // Server modules `import 'server-only'`, whose default export throws
      // outside a React Server Components build. Next swapped in its own empty
      // module at build time; tests run those modules on the server side, so
      // they get the same empty module.
      {
        find: /^server-only$/,
        replacement: require.resolve('next/dist/compiled/server-only/empty.js'),
      },
    ],
  },
  test: {
    globals: false,
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    // Node 25+ defines its own global `localStorage` (Web Storage), which
    // stays undefined without `--localstorage-file` and blocks happy-dom from
    // installing its implementation, failing every storage-backed test.
    // Turning Node's version off lets happy-dom's apply on any Node version.
    execArgv: ['--no-experimental-webstorage'],
    // PGlite's cold-start (wasm unpack + schema apply) can exceed the
    // default 10s when the full suite runs in parallel, flaking
    // queries.integration.test.ts. 30s gives headroom without masking
    // genuinely slow tests.
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: [
        'src/lib/bio/**',
        'src/lib/retry.ts',
        'src/lib/rate-limit.ts',
        'src/lib/upstash.ts',
        'src/features/**/utils/**',
        'src/features/**/types/**',
        'src/features/**/stores/**',
        'src/features/**/api/**',
        'src/stores/**',
      ],
      thresholds: {
        'src/lib/bio/**': { lines: 90 },
        'src/lib/retry.ts': { lines: 90 },
        'src/lib/rate-limit.ts': { lines: 85 },
        'src/lib/upstash.ts': { lines: 45 },
        'src/features/**/types/**': { lines: 80 },
        'src/stores/**': { lines: 65 },
      },
    },
  },
})

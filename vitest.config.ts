import { defineConfig } from 'vite-plus'
import path from 'node:path'

// Separate from vite.config.ts on purpose: Vitest can't load the Cloudflare
// plugin there (Cloudflare's Start migration guide says the same), and tests
// need none of the app's plugins.
export default defineConfig({
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }],
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: [
        'src/lib/bio/**',
        'src/features/**/utils/**',
        'src/features/**/types/**',
        'src/features/**/stores/**',
        'src/features/**/api/**',
        'src/stores/**',
      ],
      // Server-function modules are Worker wiring that only Start's compiler
      // can load; their handlers are covered in src/server/.
      exclude: ['src/**/*.functions.ts'],
      thresholds: {
        'src/lib/bio/**': { lines: 90 },
        'src/features/**/types/**': { lines: 80 },
        'src/stores/**': { lines: 65 },
      },
    },
  },
})

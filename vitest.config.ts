import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    globals: false,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
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
      },
    },
  },
})

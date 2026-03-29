import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@/lib': path.resolve(__dirname, './app/_lib'),
      '@/types': path.resolve(__dirname, './types'),
    },
  },
})

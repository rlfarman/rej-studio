import { describe, expect, it } from 'vite-plus/test'

describe("modules that import 'server-only'", () => {
  // vitest.config.ts aliases `server-only` to Next's empty module; without
  // it the package's default export throws as soon as the module loads.
  it('load under Vitest', async () => {
    const { runsOn } = await import('./fixtures/server-only-module')
    expect(runsOn).toBe('server')
  })
})

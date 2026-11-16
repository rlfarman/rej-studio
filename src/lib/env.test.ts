// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// env.ts validates at module load, so each case stubs the environment and
// then imports a fresh copy.
async function loadEnv() {
  vi.resetModules()
  return (await import('./env')).env
}

const PRODUCTION = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@db.example.com/rej',
  COMPUTE_BACKEND: 'modal',
  MODAL_API_URL: 'https://rej--process.modal.run',
  NEXT_PUBLIC_SITE_URL: 'https://rejstudio.com',
}

describe('env', () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(PRODUCTION)) {
      vi.stubEnv(key, value)
    }
    vi.stubEnv('MODAL_API_TOKEN', 'token')
    vi.stubEnv('BASIC_AUTH_PASSWORD', '')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('parses a complete production environment', async () => {
    const env = await loadEnv()
    expect(env.MODAL_API_URL).toBe('https://rej--process.modal.run')
    expect(env.MODAL_API_TOKEN).toBe('token')
  })

  it('warns, without failing, when production has no Modal token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('MODAL_API_TOKEN', '')
    const env = await loadEnv()
    expect(env.MODAL_API_TOKEN).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('MODAL_API_TOKEN'),
    )
  })

  it('treats blank values (as in .env.example) as unset', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    for (const key of [
      'DATABASE_URL',
      'COMPUTE_BACKEND',
      'MODAL_API_URL',
      'SESSION_SECRET',
      'NEXT_PUBLIC_GTM_ID',
      'NEXT_PUBLIC_SENTRY_DSN',
      'NEXT_PUBLIC_SITE_URL',
      'NEXT_PUBLIC_ENABLE_MULTI_SPLIT',
    ]) {
      vi.stubEnv(key, '')
    }
    const env = await loadEnv()
    expect(env.COMPUTE_BACKEND).toBeUndefined()
    expect(env.NEXT_PUBLIC_GTM_ID).toBeUndefined()
  })

  it('rejects a malformed URL', async () => {
    vi.stubEnv('MODAL_API_URL', 'not a url')
    await expect(loadEnv()).rejects.toThrow(/MODAL_API_URL/)
  })

  it('requires Modal in production', async () => {
    vi.stubEnv('COMPUTE_BACKEND', 'local')
    await expect(loadEnv()).rejects.toThrow(/COMPUTE_BACKEND=modal/)
  })

  it('requires SESSION_SECRET once the password gate is on', async () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', 'hunter2')
    vi.stubEnv('SESSION_SECRET', '')
    await expect(loadEnv()).rejects.toThrow(/SESSION_SECRET/)
  })
})

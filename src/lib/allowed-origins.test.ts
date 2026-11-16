import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAllowedOrigin } from './allowed-origins'

describe('isAllowedOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    'https://rejstudio.com',
    'https://www.rejstudio.com',
    'https://rej-studio-feat-x.vercel.app',
  ])('allows %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(true)
  })

  it.each([
    'https://evil.com',
    'https://rejstudio.com.evil.com',
    'https://rej-studio-x.vercel.app.evil.com',
  ])('rejects %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false)
  })

  it('allows any local port only in development', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isAllowedOrigin('http://localhost:3135')).toBe(false)

    vi.stubEnv('NODE_ENV', 'development')
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true)
    expect(isAllowedOrigin('http://localhost:3135')).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:8080')).toBe(true)
    expect(isAllowedOrigin('http://localhost.evil.com:3000')).toBe(false)
    expect(isAllowedOrigin('https://localhost:3000')).toBe(false)
  })
})

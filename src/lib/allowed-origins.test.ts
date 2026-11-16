import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAllowedOrigin } from './allowed-origins'

describe('isAllowedOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    'https://rejstudio.com',
    'https://www.rejstudio.com',
    'https://rej-studio.vercel.app',
    'https://rej-studio-k3j9x2a1b-richie-farmans-projects.vercel.app',
    'https://rej-studio-git-fix-audit-platform-richie-farmans-projects.vercel.app',
  ])('allows %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(true)
  })

  it.each([
    'https://evil.com',
    'https://rejstudio.com.evil.com',
    'https://rej-studio-x.vercel.app.evil.com',
    // Previews from another Vercel account.
    'https://rej-studio-feat-x.vercel.app',
    'https://rej-studio-abc123-someone-else.vercel.app',
    'https://rej-studio-git-main-evil-richie-farmans-projects.vercel.app.evil.com',
    'http://rej-studio-abc123-richie-farmans-projects.vercel.app',
    'https://rej-studio-ABC-richie-farmans-projects.vercel.app/x',
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

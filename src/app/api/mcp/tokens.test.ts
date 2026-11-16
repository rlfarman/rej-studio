import { afterEach, describe, expect, it, vi } from 'vitest'

import { mcpEnabled, tokenFrom } from './tokens'

const SECRET = 'a'.repeat(32)
const OTHER = 'b'.repeat(32)

const request = (authorization?: string) =>
  new Request('https://example.com/api/mcp', {
    headers: authorization ? { authorization } : {},
  })

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('whether the endpoint exists at all', () => {
  it('is off until tokens are configured', () => {
    expect(mcpEnabled()).toBe(false)
  })

  it('is on once a token is configured', () => {
    vi.stubEnv('MCP_TOKENS', `lab-agent:${SECRET}`)
    expect(mcpEnabled()).toBe(true)
  })

  it('stays off for entries that are not a usable token', () => {
    vi.stubEnv('MCP_TOKENS', 'no-secret,:orphan,short:abc, , ')
    expect(mcpEnabled()).toBe(false)
  })

  it('refuses a secret too short to be worth guessing at', () => {
    vi.stubEnv('MCP_TOKENS', 'lab-agent:12345678')
    expect(mcpEnabled()).toBe(false)
  })
})

describe('the token a request presents', () => {
  it('names the caller when the secret matches', () => {
    vi.stubEnv('MCP_TOKENS', `lab-agent:${SECRET}`)
    expect(tokenFrom(request(`Bearer ${SECRET}`))).toEqual({
      name: 'lab-agent',
    })
  })

  it('accepts the scheme however it is capitalised', () => {
    vi.stubEnv('MCP_TOKENS', `lab-agent:${SECRET}`)
    expect(tokenFrom(request(`bearer ${SECRET}`))?.name).toBe('lab-agent')
  })

  it('tells one caller from another', () => {
    vi.stubEnv('MCP_TOKENS', `alice:${SECRET},bob:${OTHER}`)

    expect(tokenFrom(request(`Bearer ${SECRET}`))?.name).toBe('alice')
    expect(tokenFrom(request(`Bearer ${OTHER}`))?.name).toBe('bob')
  })

  it('surrounding whitespace in the configuration does not change the secret', () => {
    vi.stubEnv('MCP_TOKENS', `  lab-agent : ${SECRET} `)
    expect(tokenFrom(request(`Bearer ${SECRET}`))?.name).toBe('lab-agent')
  })

  it.each([
    ['no header at all', undefined],
    ['a wrong secret', `Bearer ${OTHER}`],
    ['a prefix of the secret', `Bearer ${SECRET.slice(0, 16)}`],
    ['the name instead of the secret', 'Bearer lab-agent'],
    ['another scheme', `Basic ${SECRET}`],
    ['the secret with no scheme', SECRET],
    ['an empty bearer', 'Bearer '],
  ])('refuses %s', (_case, header) => {
    vi.stubEnv('MCP_TOKENS', `lab-agent:${SECRET}`)
    expect(tokenFrom(request(header))).toBeNull()
  })

  it('refuses everything while no token is configured', () => {
    expect(tokenFrom(request(`Bearer ${SECRET}`))).toBeNull()
  })
})

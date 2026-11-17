import { describe, expect, it } from 'vite-plus/test'

import { mcpEnabled, tokenFrom } from './tokens'

const SECRET = 'a'.repeat(32)
const OTHER = 'b'.repeat(32)

const request = (authorization?: string) =>
  new Request('https://example.com/api/mcp', {
    headers: authorization ? { authorization } : {},
  })

describe('whether the endpoint accepts anyone at all', () => {
  it('is off until tokens are configured', () => {
    expect(mcpEnabled(undefined)).toBe(false)
    expect(mcpEnabled('')).toBe(false)
  })

  it('is on once a token is configured', () => {
    expect(mcpEnabled(`lab-agent:${SECRET}`)).toBe(true)
  })

  it('stays off for entries that are not a usable token', () => {
    expect(mcpEnabled('no-secret,:orphan,short:abc, , ')).toBe(false)
  })

  it('refuses a secret too short to be worth guessing at', () => {
    expect(mcpEnabled('lab-agent:12345678')).toBe(false)
  })
})

describe('the token a request presents', () => {
  it('names the caller when the secret matches', () => {
    expect(
      tokenFrom(request(`Bearer ${SECRET}`), `lab-agent:${SECRET}`),
    ).toEqual({ name: 'lab-agent' })
  })

  it('accepts the scheme however it is capitalised', () => {
    expect(
      tokenFrom(request(`bearer ${SECRET}`), `lab-agent:${SECRET}`)?.name,
    ).toBe('lab-agent')
  })

  it('tells one caller from another', () => {
    const configured = `alice:${SECRET},bob:${OTHER}`

    expect(tokenFrom(request(`Bearer ${SECRET}`), configured)?.name).toBe(
      'alice',
    )
    expect(tokenFrom(request(`Bearer ${OTHER}`), configured)?.name).toBe('bob')
  })

  it('surrounding whitespace in the configuration does not change the secret', () => {
    expect(
      tokenFrom(request(`Bearer ${SECRET}`), `  lab-agent : ${SECRET} `)?.name,
    ).toBe('lab-agent')
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
    expect(tokenFrom(request(header), `lab-agent:${SECRET}`)).toBeNull()
  })

  it('refuses everything while no token is configured', () => {
    expect(tokenFrom(request(`Bearer ${SECRET}`), undefined)).toBeNull()
  })
})

// @vitest-environment node
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWTVerifyGetKey,
} from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test'

const log = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => log }))

import { accessIssuer, identify } from './access'

// Real tokens, signed with a real RS256 key: the verification under test is
// jose's, configured by identify(), and a mock of it would test nothing.

const TEAM = 'lab.cloudflareaccess.com'
const ISSUER = `https://${TEAM}`
const AUD = 'aud-tag-for-rej-studio'
const KID = 'key-1'
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }

let signingKey: CryptoKey
let otherKey: CryptoKey
let keys: JWTVerifyGetKey

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  signingKey = pair.privateKey
  otherKey = (await generateKeyPair('RS256')).privateKey
  const jwk = await exportJWK(pair.publicKey)
  keys = createLocalJWKSet({ keys: [{ ...jwk, kid: KID, alg: 'RS256' }] })
})

interface TokenOptions {
  key?: CryptoKey
  issuer?: string
  audience?: string
  email?: string | null
  expiresIn?: string | number
}

function token({
  key = signingKey,
  issuer = ISSUER,
  audience = AUD,
  email = 'ada@lab.example',
  expiresIn = '10m',
}: TokenOptions = {}): Promise<string> {
  const jwt = new SignJWT(email === null ? {} : { email })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
  return jwt.sign(key)
}

function request(jwt?: string, url = 'https://rej.example.com/api/designs') {
  return new Request(url, {
    headers: jwt ? { 'cf-access-jwt-assertion': jwt } : {},
  })
}

describe('identify with Cloudflare Access configured', () => {
  it('accepts a valid token and takes the email from its claims', async () => {
    expect(await identify(request(await token()), env, { keys })).toEqual({
      ok: true,
      email: 'ada@lab.example',
    })
  })

  it('refuses a request with no token', async () => {
    expect(await identify(request(), env, { keys })).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('refuses an expired token', async () => {
    const expired = await token({
      expiresIn: Math.floor(Date.now() / 1000) - 60,
    })
    expect(await identify(request(expired), env, { keys })).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('refuses a token minted for another Access application', async () => {
    const other = await token({ audience: 'some-other-app' })
    expect(await identify(request(other), env, { keys })).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('refuses a token from another team', async () => {
    const other = await token({ issuer: 'https://evil.cloudflareaccess.com' })
    expect(await identify(request(other), env, { keys })).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('refuses a token with a bad signature', async () => {
    // Same kid, signed by a key that is not the team's.
    const forged = await token({ key: otherKey })
    expect(await identify(request(forged), env, { keys })).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('refuses a token whose payload was altered after signing', async () => {
    const [header, , signature] = (await token()).split('.')
    const payload = Buffer.from(
      JSON.stringify({ email: 'mallory@lab.example', aud: AUD, iss: ISSUER }),
    ).toString('base64url')
    const tampered = `${header}.${payload}.${signature}`
    expect(await identify(request(tampered), env, { keys })).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('refuses an unsigned token', async () => {
    const encode = (part: object) =>
      Buffer.from(JSON.stringify(part)).toString('base64url')
    const unsigned = `${encode({ alg: 'none' })}.${encode({
      email: 'ada@lab.example',
      aud: AUD,
      iss: ISSUER,
      exp: Math.floor(Date.now() / 1000) + 600,
    })}.`
    expect(await identify(request(unsigned), env, { keys })).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('refuses garbage', async () => {
    expect(await identify(request('not-a-jwt'), env, { keys })).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('refuses a service token, which has no email to own a design', async () => {
    const service = await token({ email: null })
    expect(await identify(request(service), env, { keys })).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('ignores DEV_ACCESS_EMAIL when Access is configured', async () => {
    const result = await identify(
      request(undefined, 'http://localhost:3000/api/designs'),
      { ...env, DEV_ACCESS_EMAIL: 'dev@example.com' },
      { keys },
    )
    expect(result).toMatchObject({ ok: false, status: 401 })
  })

  it('answers 503, not 401, when the keys cannot be fetched', async () => {
    const unreachable: JWTVerifyGetKey = () =>
      Promise.reject(new TypeError('fetch failed'))
    expect(
      await identify(request(await token()), env, { keys: unreachable }),
    ).toMatchObject({ ok: false, status: 503 })
  })
})

describe('identify without Cloudflare Access', () => {
  it('is off: 503, with no fallback to trusting anyone', async () => {
    expect(await identify(request(await token()), {})).toMatchObject({
      ok: false,
      status: 503,
    })
  })

  it('is off when only half configured', async () => {
    for (const half of [{ ACCESS_TEAM_DOMAIN: TEAM }, { ACCESS_AUD: AUD }]) {
      expect(
        await identify(request(await token()), half, { keys }),
      ).toMatchObject({ ok: false, status: 503 })
    }
  })

  it('honours DEV_ACCESS_EMAIL on a loopback host, loudly', async () => {
    log.warn.mockClear()
    for (const host of ['localhost:3000', '127.0.0.1:8787']) {
      expect(
        await identify(request(undefined, `http://${host}/api/designs`), {
          DEV_ACCESS_EMAIL: 'dev@example.com',
        }),
      ).toEqual({ ok: true, email: 'dev@example.com' })
    }
    expect(log.warn).toHaveBeenCalledTimes(2)
    expect(String(log.warn.mock.calls[0]?.[0])).toMatch(/DEV_ACCESS_EMAIL/)
  })

  it('refuses DEV_ACCESS_EMAIL anywhere but a loopback host', async () => {
    log.error.mockClear()
    expect(
      await identify(request(), { DEV_ACCESS_EMAIL: 'dev@example.com' }),
    ).toMatchObject({ ok: false, status: 503 })
    expect(log.error).toHaveBeenCalledOnce()
  })
})

describe('accessIssuer', () => {
  it.each([
    ['lab.cloudflareaccess.com', ISSUER],
    ['https://lab.cloudflareaccess.com/', ISSUER],
    ['  lab.cloudflareaccess.com ', ISSUER],
    ['http://lab.cloudflareaccess.com', null],
    ['', null],
  ])('%j → %j', (input, expected) => {
    expect(accessIssuer(input)).toBe(expected)
  })
})

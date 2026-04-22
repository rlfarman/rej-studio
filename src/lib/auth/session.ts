/**
 * Signed-cookie session helpers.
 *
 * Stateless: the cookie carries a payload + HMAC-SHA256 signature. No database
 * round-trip on read — middleware verifies the signature and expiry and that's
 * it. Uses Web Crypto so the same code runs in Edge middleware, Node route
 * handlers, and tests.
 */

export const SESSION_COOKIE_NAME = 'rej_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 1 week

type SessionPayload = {
  v: 1
  exp: number
}

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array<ArrayBuffer> {
  const padded =
    str.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  const buf = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET is not set or is shorter than 32 characters.',
    )
  }
  return secret
}

export async function signSession(
  ttlSeconds: number = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  const payload: SessionPayload = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const key = await importKey(getSecret())
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64)),
  )
  return `${payloadB64}.${toBase64Url(sig)}`
}

export async function verifySession(
  cookieValue: string | undefined,
): Promise<SessionPayload | null> {
  if (!cookieValue) return null
  const parts = cookieValue.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  try {
    const key = await importKey(getSecret())
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(sigB64),
      encoder.encode(payloadB64),
    )
    if (!ok) return null
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadB64)),
    ) as SessionPayload
    if (payload.v !== 1) return null
    if (typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/**
 * Timing-safe equal for the password check. Matches the pattern previously
 * used in the basic-auth middleware.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const aBuf = encoder.encode(a)
  const bBuf = encoder.encode(b)
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const aMac = new Uint8Array(await crypto.subtle.sign('HMAC', key, aBuf))
  const bMac = new Uint8Array(await crypto.subtle.sign('HMAC', key, bBuf))
  let result = aMac.length === bMac.length ? 1 : 0
  for (let i = 0; i < aMac.length; i++) {
    result &= aMac[i] === bMac[i] ? 1 : 0
  }
  return result === 1
}

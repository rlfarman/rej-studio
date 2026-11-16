/**
 * Signed-cookie session helpers.
 *
 * Stateless: the cookie carries a payload + HMAC-SHA256 signature. No database
 * round-trip on read — middleware verifies the signature and expiry and that's
 * it. Uses Web Crypto so the same code runs in Edge middleware, Node route
 * handlers, and tests.
 *
 * The signing key is derived from SESSION_SECRET *and* the shared password,
 * so rotating BASIC_AUTH_PASSWORD signs everyone out. Keyed on the secret
 * alone, a cookie issued under the old password stayed valid for its full
 * week.
 */

export const SESSION_COOKIE_NAME = 'rej_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 1 week

export type Session = {
  v: 1
  /** Random per-sign-in id; keys rate limits for signed-in callers. */
  sid: string
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

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET is not set or is shorter than 32 characters.',
    )
  }
  return secret
}

function getPassword(): string {
  const password = process.env.BASIC_AUTH_PASSWORD
  if (!password) {
    throw new Error(
      'BASIC_AUTH_PASSWORD is not set; sessions only exist while the password gate is on.',
    )
  }
  return password
}

/**
 * HMAC key derived with HKDF-SHA256 from SESSION_SECRET, salted with a hash
 * of the current password, so a cookie signed under an old password fails
 * verification once the password changes.
 */
async function signingKey(): Promise<CryptoKey> {
  const secret = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    'HKDF',
    false,
    ['deriveKey'],
  )
  const salt = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(getPassword()),
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: encoder.encode('rej-studio session v1'),
    },
    secret,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  )
}

export async function signSession(
  ttlSeconds: number = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  const payload: Session = {
    v: 1,
    sid: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const key = await signingKey()
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64)),
  )
  return `${payloadB64}.${toBase64Url(sig)}`
}

export async function verifySession(
  cookieValue: string | undefined,
): Promise<Session | null> {
  if (!cookieValue) return null
  const parts = cookieValue.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  try {
    const key = await signingKey()
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(sigB64),
      encoder.encode(payloadB64),
    )
    if (!ok) return null
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadB64)),
    ) as Partial<Session>
    if (payload.v !== 1) return null
    if (typeof payload.sid !== 'string' || payload.sid === '') return null
    if (typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return { v: 1, sid: payload.sid, exp: payload.exp }
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

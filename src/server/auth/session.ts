import type { ServerEnv } from '../env'

/**
 * The passcode gate's sessions: a signed cookie, no server-side state.
 *
 * The cookie carries a payload and an HMAC-SHA256 signature, so the Worker
 * checks it with WebCrypto alone. The signing key is derived from
 * SESSION_SECRET *and* the passcode, so changing BASIC_AUTH_PASSWORD signs
 * everyone out: keyed on the secret alone, a cookie issued under the old
 * passcode would stay valid until it expired.
 */

export const SESSION_COOKIE_NAME = 'rej_session'
/** A month: the gate is a shared passcode, not an account to protect. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export interface Session {
  v: 1
  /**
   * Random per sign-in. Owns that browser's cloud designs and keys its
   * budgets; it is not a credential on its own, since a cookie cannot be made
   * for it without SESSION_SECRET.
   */
  sid: string
  exp: number
}

/**
 * Whether the gate is on.
 *
 * - `on`: BASIC_AUTH_PASSWORD and a SESSION_SECRET of 32+ characters.
 * - `off`: neither. Only loopback requests get through (local development);
 *   a deployed Worker without them refuses everything rather than serving
 *   the app to anyone.
 * - `misconfigured`: one without the other, or a short secret. Refuses
 *   everything rather than run half-checked.
 */
export type GateConfig =
  | { mode: 'on'; password: string; secret: string }
  | { mode: 'off' }
  | { mode: 'misconfigured'; reason: string }

const MIN_SECRET_LENGTH = 32

export function gateConfig(env: ServerEnv): GateConfig {
  const password = env.BASIC_AUTH_PASSWORD ?? ''
  const secret = env.SESSION_SECRET ?? ''
  if (!password && !secret) return { mode: 'off' }
  if (!password) {
    return {
      mode: 'misconfigured',
      reason: 'SESSION_SECRET without BASIC_AUTH_PASSWORD',
    }
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    return {
      mode: 'misconfigured',
      reason: `SESSION_SECRET missing or shorter than ${MIN_SECRET_LENGTH} characters`,
    }
  }
  return { mode: 'on', password, secret }
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/** A request to this machine: the only kind an `off` gate lets through. */
export function isLoopback(request: Request): boolean {
  return LOOPBACK.has(new URL(request.url).hostname)
}

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded =
    text.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (text.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** HKDF from SESSION_SECRET, salted with a hash of the passcode. */
async function signingKey(
  password: string,
  secret: string,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  )
  const salt = await crypto.subtle.digest('SHA-256', encoder.encode(password))
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: encoder.encode('rej-studio session v1'),
    },
    base,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  )
}

export async function signSession(
  config: Extract<GateConfig, { mode: 'on' }>,
  now = Date.now(),
): Promise<string> {
  const payload: Session = {
    v: 1,
    sid: crypto.randomUUID(),
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS,
  }
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const key = await signingKey(config.password, config.secret)
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(body)),
  )
  return `${body}.${toBase64Url(signature)}`
}

export async function verifySession(
  config: Extract<GateConfig, { mode: 'on' }>,
  token: string | undefined,
  now = Date.now(),
): Promise<Session | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, signature] = parts
  try {
    const key = await signingKey(config.password, config.secret)
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(signature),
      encoder.encode(body),
    )
    if (!valid) return null
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as Partial<Session>
    if (payload.v !== 1) return null
    if (typeof payload.sid !== 'string' || payload.sid === '') return null
    if (typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(now / 1000)) return null
    return { v: 1, sid: payload.sid, exp: payload.exp }
  } catch {
    // Malformed base64 or JSON: not a session.
    return null
  }
}

/** The session cookie's value from a request, if it has one. */
function sessionCookie(request: Request): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE_NAME) return rest.join('=')
  }
  return undefined
}

/** The request's valid session, or null. Only meaningful with the gate on. */
export async function readSession(
  request: Request,
  config: Extract<GateConfig, { mode: 'on' }>,
): Promise<Session | null> {
  return verifySession(config, sessionCookie(request))
}

/**
 * Compares the submitted passcode in constant time: both sides are MACed
 * with a fresh key first, so neither length nor content leaks through how
 * long the comparison takes.
 */
export async function passcodeMatches(
  submitted: string,
  expected: string,
): Promise<boolean> {
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const [a, b] = await Promise.all([
    crypto.subtle.sign('HMAC', key, encoder.encode(submitted)),
    crypto.subtle.sign('HMAC', key, encoder.encode(expected)),
  ])
  const left = new Uint8Array(a)
  const right = new Uint8Array(b)
  let same = left.length === right.length ? 1 : 0
  for (let i = 0; i < left.length; i++) same &= left[i] === right[i] ? 1 : 0
  return same === 1
}

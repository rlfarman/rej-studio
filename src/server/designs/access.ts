import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose'

import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import { designsCopy } from './copy'

/**
 * Who is asking, for `/api/designs`. Fails closed.
 *
 * Cloudflare Access sits in front of the hostname and signs every request it
 * lets through with a JWT in `Cf-Access-Jwt-Assertion`. The Worker does not
 * take Access's word for it by trusting the header's presence: it verifies the
 * token's signature against the team's published keys, its issuer, its
 * audience (this application's AUD tag, so a token minted for another Access
 * app on the same team is refused) and its expiry, and takes the email from
 * the verified claims. That matters because `/api/mcp` is bypassed by Access
 * and so is the same Worker reachable without Access in front of it.
 *
 * - With `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` set, a request needs a valid
 *   token carrying an email; anything else is 401.
 * - With neither, the API is off (503) — unless `DEV_ACCESS_EMAIL` is set, a
 *   local-development stand-in that is honoured only for requests to a
 *   loopback host and logged loudly every time. It must never be set on a
 *   deployed Worker; `wrangler.jsonc` does not declare it, so it can only come
 *   from `.dev.vars` or `--var`.
 * - With only one of the two set, the deployment is misconfigured, and the
 *   API is off rather than half-checked.
 *
 * jose runs on web standards (WebCrypto and fetch), so this needs no
 * `nodejs_compat`.
 */

const log = createLogger('designs')

export type Identity =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 503; message: string }

/** The team's issuer origin, from `team.cloudflareaccess.com` or a URL. */
export function accessIssuer(teamDomain: string): string | null {
  const trimmed = teamDomain.trim()
  if (!trimmed) return null
  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    )
    return url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

/**
 * The team's signing keys, one remote set per team for the life of the
 * isolate. jose caches the fetched keys and refetches (with a cooldown) when
 * a token names a key it has not seen, which is how Access key rotation is
 * picked up.
 */
const remoteKeySets = new Map<string, JWTVerifyGetKey>()

function remoteKeys(issuer: string): JWTVerifyGetKey {
  let keys = remoteKeySets.get(issuer)
  if (!keys) {
    keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer))
    remoteKeySets.set(issuer, keys)
  }
  return keys
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

interface IdentifyOptions {
  /** The keys to verify against; the team's published set when omitted. */
  keys?: JWTVerifyGetKey
}

export async function identify(
  request: Request,
  env: ServerEnv,
  { keys }: IdentifyOptions = {},
): Promise<Identity> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim() ?? ''
  const audience = env.ACCESS_AUD?.trim() ?? ''

  if (teamDomain || audience) {
    const issuer = accessIssuer(teamDomain)
    if (!issuer || !audience) {
      log.error(
        'Access is half-configured: set both ACCESS_TEAM_DOMAIN and ACCESS_AUD; refusing cloud designs',
      )
      return { ok: false, status: 503, message: designsCopy.http.notConfigured }
    }
    return verifyAccess(request, issuer, audience, keys ?? remoteKeys(issuer))
  }

  const devEmail = env.DEV_ACCESS_EMAIL?.trim()
  if (devEmail) {
    // A deployed Worker is never on a loopback host, so even a
    // DEV_ACCESS_EMAIL set there by mistake identifies nobody.
    if (!LOOPBACK.has(new URL(request.url).hostname)) {
      log.error(
        'DEV_ACCESS_EMAIL is set on a non-local request and was ignored. Remove it from this deployment.',
      )
      return { ok: false, status: 503, message: designsCopy.http.notConfigured }
    }
    log.warn(
      `!!! DEV_ACCESS_EMAIL is set: treating this request as ${devEmail} without Cloudflare Access. Local development only; never set it on a deployed Worker. !!!`,
    )
    return { ok: true, email: devEmail }
  }

  return { ok: false, status: 503, message: designsCopy.http.notConfigured }
}

async function verifyAccess(
  request: Request,
  issuer: string,
  audience: string,
  keys: JWTVerifyGetKey,
): Promise<Identity> {
  const token = request.headers.get('cf-access-jwt-assertion')
  if (!token) {
    return { ok: false, status: 401, message: designsCopy.http.unauthorized }
  }
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience,
      // Access signs with RS256. Pinning it refuses `none` and any algorithm
      // swap, whatever the token's header claims.
      algorithms: ['RS256'],
      requiredClaims: ['exp'],
    })
    // A service token has no email: it is a machine, and a design needs a
    // person to own it.
    const email = typeof payload.email === 'string' ? payload.email.trim() : ''
    if (!email) {
      return { ok: false, status: 401, message: designsCopy.http.noEmail }
    }
    return { ok: true, email }
  } catch (error) {
    // Expected refusals (expired, wrong audience, bad signature) are the
    // caller's problem; a failure to fetch the keys is ours.
    if (error instanceof errors.JOSEError && !isKeyFetchFailure(error)) {
      log.warn('refused an Access token', { reason: error.code })
      return { ok: false, status: 401, message: designsCopy.http.unauthorized }
    }
    log.error('could not verify an Access token', error)
    return {
      ok: false,
      status: 503,
      message: designsCopy.http.accessUnavailable,
    }
  }
}

function isKeyFetchFailure(error: errors.JOSEError): boolean {
  return (
    error instanceof errors.JWKSTimeout ||
    error.code === 'ERR_JWKS_INVALID' ||
    // A non-200 or unparsable answer from the certs endpoint surfaces as a
    // plain JOSEError naming the key set.
    (error.code === 'ERR_JOSE_GENERIC' &&
      /JSON Web Key Set/.test(error.message))
  )
}

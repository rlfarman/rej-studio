import { createAuthClient } from 'better-auth/client'
import { emailOTPClient } from 'better-auth/client/plugins'

import { accountCopy } from '@/copy/account'

/**
 * Better Auth's browser client, for signing in and out. Loaded on demand
 * (./actions.ts), never with a page: reading who is signed in is a plain
 * fetch (./account.ts).
 *
 * Each call answers a value — done, or a message for the person — rather
 * than throwing.
 */

const client = createAuthClient({
  basePath: '/api/auth',
  plugins: [emailOTPClient()],
})

/**
 * Why a call was refused, where the caller does something with it: a wrong
 * code is counted towards the five the server allows (the dialog), anything
 * else only has its message shown.
 */
export type AuthFailure = 'wrong-code' | 'too-many-attempts' | 'other'

export type AuthResult =
  | { ok: true }
  | { ok: false; message: string; reason: AuthFailure }

const copy = accountCopy.errors

/** The person-readable message for a Better Auth error, and why. */
function describe(error: {
  code?: string
  message?: string
  status?: number
}): { message: string; reason: AuthFailure } {
  switch (error.code) {
    case 'INVALID_OTP':
    case 'OTP_EXPIRED':
      return { message: copy.wrongCode, reason: 'wrong-code' }
    case 'TOO_MANY_ATTEMPTS':
      return { message: copy.tooManyAttempts, reason: 'too-many-attempts' }
    case 'INVALID_EMAIL':
      return { message: copy.invalidEmail, reason: 'other' }
    // Our own refusals (src/server/accounts/handler.ts) carry their message.
    case 'RATE_LIMITED':
    case 'ACCOUNTS_UNAVAILABLE':
      return { message: error.message ?? copy.generic, reason: 'other' }
    default:
      return { message: copy.generic, reason: 'other' }
  }
}

async function attempt(
  run: () => Promise<{ error: unknown }>,
): Promise<AuthResult> {
  try {
    const { error } = await run()
    if (!error) return { ok: true }
    return {
      ok: false,
      ...describe(error as Parameters<typeof describe>[0]),
    }
  } catch {
    return { ok: false, message: copy.unreachable, reason: 'other' }
  }
}

/** Emails a sign-in code; a new address gets an account on first sign-in. */
export function sendSignInCode(email: string): Promise<AuthResult> {
  return attempt(() =>
    client.emailOtp.sendVerificationOtp({ email, type: 'sign-in' }),
  )
}

export function signInWithCode(
  email: string,
  code: string,
): Promise<AuthResult> {
  return attempt(() => client.signIn.emailOtp({ email, otp: code }))
}

/**
 * Starts "Sign in with Google": the client navigates to Google, which
 * returns to the Worker and then to `returnTo` (a path on this site).
 */
export function signInWithGoogle(returnTo: string): Promise<AuthResult> {
  return attempt(() =>
    client.signIn.social({ provider: 'google', callbackURL: returnTo }),
  )
}

export function signOut(): Promise<AuthResult> {
  return attempt(() => client.signOut())
}

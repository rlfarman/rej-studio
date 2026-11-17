import { createLogger } from '@/lib/logger'

import type { ServerEnv } from '../env'
import { accountsCopy } from './copy'
import { rememberSignInCode } from './dev-mailbox'

/**
 * Sends a sign-in code with Cloudflare Email Service (the `AUTH_EMAIL`
 * `send_email` binding), from `AUTH_EMAIL_FROM` on rejstudio.com.
 *
 * Locally, wrangler and the Cloudflare Vite plugin simulate the binding: the
 * message is logged and saved under .wrangler, not sent. Where there is no
 * binding at all (a Worker run without wrangler.jsonc, or a test), a local
 * request gets the code printed to the console instead; anywhere else that
 * is an error, because a code in a deployed Worker's logs is a credential
 * in the logs.
 */

const log = createLogger('accounts')

export const SIGN_IN_CODE_MINUTES = 10

interface SignInCode {
  to: string
  code: string
  /** Whether the request came from this machine (local development). */
  local: boolean
}

export type SendOutcome = 'sent' | 'logged'

export async function sendSignInCode(
  env: ServerEnv,
  { to, code, local }: SignInCode,
): Promise<SendOutcome> {
  rememberSignInCode(env, to, code)
  const copy = accountsCopy.email
  const binding = env.AUTH_EMAIL
  if (binding) {
    const from = env.AUTH_EMAIL_FROM
    if (!from) throw new Error('AUTH_EMAIL_FROM is not set')
    await binding.send({
      to,
      from: { email: from, name: copy.fromName },
      subject: copy.subject(code),
      text: copy.text(code, SIGN_IN_CODE_MINUTES),
      html: copy.html(code, SIGN_IN_CODE_MINUTES),
    })
    log.info('sign-in code sent')
    return 'sent'
  }
  if (!local) {
    throw new Error('no AUTH_EMAIL binding: cannot send a sign-in code')
  }
  // Loud on purpose: this is the only way to see the code.
  console.warn(
    [
      '',
      '='.repeat(60),
      `  REJ Studio sign-in code for ${to}: ${code}`,
      '  (no AUTH_EMAIL binding, so it was not emailed)',
      '='.repeat(60),
      '',
    ].join('\n'),
  )
  return 'logged'
}

import type { ServerEnv } from '../env'
import { gateConfig, isLoopback, readSession } from '../auth/session'
import { designsCopy } from './copy'

/**
 * Who is asking, for the cloud-design server functions. Fails closed.
 *
 * The Worker's passcode gate (src/server/auth/gate.ts) has already turned
 * away requests without a session, but this checks again rather than trust
 * that every route is behind it: the cookie is verified here too, and its
 * per-sign-in id owns the design. Only that browser's session can delete it;
 * anyone signed in can read it (see "Who may do what" in ./service.ts).
 *
 * With no passcode configured, the gate is off and only loopback requests
 * reach the Worker (local development); they are all one owner, `local`.
 */

export type Identity =
  | { ok: true; owner: string }
  | { ok: false; status: 401 | 503; message: string }

/** The owner of designs submitted from local development with no passcode. */
const LOCAL_OWNER = 'local'

export async function identify(
  request: Request,
  env: ServerEnv,
): Promise<Identity> {
  const config = gateConfig(env)
  if (config.mode === 'off') {
    return isLoopback(request)
      ? { ok: true, owner: LOCAL_OWNER }
      : { ok: false, status: 503, message: designsCopy.http.notConfigured }
  }
  if (config.mode === 'misconfigured') {
    return { ok: false, status: 503, message: designsCopy.http.notConfigured }
  }
  const session = await readSession(request, config)
  if (!session) {
    return { ok: false, status: 401, message: designsCopy.http.unauthorized }
  }
  return { ok: true, owner: `session:${session.sid}` }
}

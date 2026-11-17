import { bearerFrom, secretsMatch } from './bearer'
import type { ServerEnv } from './env'
import { probeGeneData } from './gene-data'
import { versionInfo } from './version'

/**
 * `/api/health`: is the Worker up?
 *
 * Anonymous callers (uptime monitors) get liveness and nothing else: the
 * Worker answered, so it is up. That costs nothing and touches no storage.
 *
 * The one thing outside the Worker worth probing is the corpus in R2, so a
 * deep check exists only when that binding does, and only for a caller with
 * HEALTH_AUTH_TOKEN; it is a `head` of the index, which reads no data. The
 * response shapes are the Next route's, which `.github/workflows/uptime.yml`
 * parses: `{ status }` for liveness; `{ status, timestamp, version, checks }`
 * for a deep check, with 503 when a check fails.
 */

type CheckStatus = 'ok' | 'fail' | 'skipped'

interface Check {
  status: CheckStatus
  latencyMs?: number
  error?: string
}

interface DeepHealth {
  status: 'ok' | 'degraded'
  timestamp: string
  version: string
  checks: {
    /** The corpus index in R2; skipped when the corpus isn't in R2. */
    geneData: Check
  }
}

const NO_STORE = { 'cache-control': 'no-store, max-age=0' }

function canRunDeepChecks(request: Request, env: ServerEnv): boolean {
  // No token configured means no deep checks at all: unlike the Next route,
  // there is no "outside production" to fall back on, since the Worker can't
  // tell `wrangler dev` from a deploy.
  const expected = env.HEALTH_AUTH_TOKEN?.trim()
  if (!expected || !env.GENE_DATA) return false
  const presented = bearerFrom(request)
  return presented !== null && secretsMatch(presented, expected)
}

async function checkGeneData(env: ServerEnv): Promise<Check> {
  // Date.now() advances across I/O on Workers, which is all this measures.
  const started = Date.now()
  try {
    const probe = await probeGeneData(env)
    if (!probe) return { status: 'skipped' }
    const latencyMs = Date.now() - started
    return probe.ok
      ? { status: 'ok', latencyMs }
      : { status: 'fail', latencyMs, error: probe.error }
  } catch (error) {
    return {
      status: 'fail',
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'unknown error',
    }
  }
}

export async function handleHealth(
  request: Request,
  env: ServerEnv,
): Promise<Response> {
  if (!canRunDeepChecks(request, env)) {
    return Response.json({ status: 'ok' }, { headers: NO_STORE })
  }

  const geneData = await checkGeneData(env)
  const degraded = geneData.status === 'fail'
  const body: DeepHealth = {
    status: degraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    version: versionInfo().version,
    checks: { geneData },
  }
  return Response.json(body, {
    status: degraded ? 503 : 200,
    headers: NO_STORE,
  })
}

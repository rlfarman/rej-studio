import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { isAuthGateActive } from '@/lib/auth/gate'
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session'
import { fetchJobStatus } from '@/features/design-tool/api/job-backend'
import type { JobErrorCode } from '@/features/design-tool/types/backend-contract'

/**
 * Job status polling.
 *
 * This is a route handler rather than a server action on purpose: the client
 * dispatches server actions one at a time, so a 0.5–2s poll loop as an action
 * would sit in front of submits, cancels and gene searches. Submit and cancel
 * stay actions in `features/design-tool/api/jobs.ts`.
 *
 * The proxy already answers 401 for `/api/*` without a session; the session is
 * verified again here because a route handler is a public endpoint.
 */

const JOB_ID_RE = /^[A-Za-z0-9_-]{1,200}$/

const STATUS_BY_CODE: Partial<Record<JobErrorCode, number>> = {
  unauthorized: 401,
  invalid_input: 422,
  not_found: 404,
  rate_limited: 429,
}

async function hasSession(): Promise<boolean> {
  if (!isAuthGateActive()) return true
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  return Boolean(await verifySession(token))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasSession())) {
    return noStore({ error: 'Authentication required.' }, 401)
  }

  const { id } = await params
  if (!JOB_ID_RE.test(id)) {
    return noStore({ error: 'Invalid job id.' }, 400)
  }

  // Forward the client's abort (TanStack Query cancels in-flight polls) so a
  // navigated-away poll doesn't hold a connection to the compute backend.
  const result = await fetchJobStatus(id, request.signal)
  if (!result.ok) {
    return noStore(
      { error: result.error },
      STATUS_BY_CODE[result.error.code] ?? 502,
    )
  }
  return noStore(result.data, 200)
}

function noStore(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

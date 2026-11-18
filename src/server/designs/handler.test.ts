// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// The optimizer's module is WebAssembly imported the Cloudflare way, which
// only instantiates in workerd; nothing here runs a design.
vi.mock('../mcp/optimizer', () => ({ designOnWorker: vi.fn() }))

import {
  CLOUD_DESIGN_MAX_BASES,
  cloudDesignSchema,
  type CloudAnswer,
} from '@/features/design-tool/types/cloud-design'

import {
  gateConfig,
  SESSION_COOKIE_NAME,
  signSession,
  verifySession,
} from '../auth/session'
import { buildJobParams } from '@/features/design-tool/utils/form-handler'

import {
  createTestD1,
  failingD1,
  fakeEmail,
  signInWithCode,
} from '../accounts/test-utils'
import type { ServerEnv } from '../env'
import {
  deleteDesign,
  listMyDesigns,
  readDesign,
  statusOf,
  submitDesign,
} from './handler'
import { STATUS_RETRY_DELAYS_MS } from './service'
import { resultKey, type CloudDesignOutput } from './run'
import {
  CDS,
  fakeBucket,
  fakeLimiter,
  FakeWorkflow,
  formValues,
  RESULT,
} from './test-utils'

// The cloud-design server functions' handlers, through the real service,
// against an in-memory Workflow binding and an in-memory D1 with the
// committed migrations. Each answer is read as the client gets it: its HTTP
// status (as the server function sends it) and its value. Identity is real:
// a passcode session cookie signed under the passcode, and an account signed
// in through Better Auth with an emailed code, so a test switches who is
// asking by sending another caller's cookies.

const SITE = 'http://localhost:3000'
const BASE = `${SITE}/_serverFn/x`
const GATE = {
  BASIC_AUTH_PASSWORD: 'splice-test',
  SESSION_SECRET: 'a-test-session-secret-of-at-least-32-chars',
}
const ACCOUNTS = {
  BETTER_AUTH_SECRET: 'a-test-accounts-secret-of-at-least-32-chars',
  AUTH_EMAIL_FROM: 'sign-in@rejstudio.com',
}

interface Caller {
  /** The owner their designs carry; '' for someone without an account. */
  owner: string
  cookie: string
}

const mailbox = fakeEmail()
const accounts = createTestD1()

/** Past the passcode, with no account. */
async function passcodeOnly(): Promise<Caller & { sid: string }> {
  const config = gateConfig(GATE)
  if (config.mode !== 'on') throw new Error('test gate is not on')
  const token = await signSession(config)
  const session = await verifySession(config, token)
  return {
    owner: '',
    sid: session!.sid,
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
  }
}

/** Past the passcode and signed in to the account for `email`. */
async function withAccount(email: string): Promise<Caller> {
  const passcode = await passcodeOnly()
  const { cookie, userId } = await signInWithCode(
    {
      ...GATE,
      ...ACCOUNTS,
      AUTH_DB: accounts.binding,
      AUTH_EMAIL: mailbox.binding,
    },
    mailbox,
    email,
    SITE,
  )
  return { owner: `user:${userId}`, cookie: `${passcode.cookie}; ${cookie}` }
}

let ADA: Caller
let BOB: Caller
let PASSCODE_ONLY: Caller & { sid: string }

beforeAll(async () => {
  ADA = await withAccount('ada@example.com')
  BOB = await withAccount('bob@example.com')
  PASSCODE_ONLY = await passcodeOnly()
})

let workflow: FakeWorkflow
let limiter: ReturnType<typeof fakeLimiter>
let env: ServerEnv

/** Which caller each env stands for: a request built for it carries their cookie. */
const callers = new WeakMap<ServerEnv, Caller>()

beforeEach(() => {
  workflow = new FakeWorkflow()
  limiter = fakeLimiter()
  accounts.sqlite.exec('delete from cloud_design')
  env = {
    DESIGN_WORKFLOW: workflow.binding(),
    DESIGN_LIMITER: limiter.binding,
    AUTH_DB: accounts.binding,
    ...GATE,
    ...ACCOUNTS,
  }
  callers.set(env, ADA)
})

function as(caller: Caller, base: ServerEnv = env): ServerEnv {
  const e = { ...base }
  callers.set(e, caller)
  return e
}

/** A caller with no session at all. */
const NOBODY: Caller = { owner: '', cookie: '' }

/** Ada, unless the env was made for someone else with as(). */
function headersFor(e: ServerEnv): Record<string, string> {
  const caller = callers.get(e) ?? ADA
  return caller.cookie ? { cookie: caller.cookie } : {}
}

/**
 * Runs a request whose retries wait on setTimeout to completion under fake
 * timers. The session check is WebCrypto, which settles on the real event
 * loop, so time is advanced in steps with a real turn between them rather
 * than all at once before the request has reached its first timer.
 */
async function settle<T>(pending: Promise<T>): Promise<T> {
  let done = false
  void pending.finally(() => {
    done = true
  })
  while (!done) {
    await vi.advanceTimersByTimeAsync(250)
    await new Promise((resolve) => setImmediate(resolve))
  }
  return pending
}

function callAs(e: ServerEnv) {
  return new Request(BASE, { method: 'POST', headers: headersFor(e) })
}

/** An answer as the client reads it: the status sent, and the value or refusal. */
async function sent(
  pending: Promise<CloudAnswer<unknown>>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const answer = await pending
  const created =
    answer.ok &&
    (answer.data as { existing?: boolean } | null)?.existing === false
  return {
    status: statusOf(answer, created),
    json: (answer.ok ? (answer.data ?? {}) : answer) as Record<string, unknown>,
  }
}

function submit(input: unknown = { values: formValues() }, e = env) {
  return sent(submitDesign(callAs(e), e, input))
}

function read(id: string, e = env) {
  return sent(readDesign(callAs(e), e, { id }))
}

function remove(id: string, e = env) {
  return sent(deleteDesign(callAs(e), e, { id }))
}

function list(e = env) {
  return sent(listMyDesigns(callAs(e), e))
}

/** Finishes an instance the way the Workflow would. */
function complete(id: string, output: Partial<CloudDesignOutput> = {}) {
  const instance = workflow.instances.get(id)!
  const { values, owner, bases, submittedAt } = instance.params
  const merged: Record<string, unknown> = {
    values,
    owner,
    bases,
    submittedAt,
    seconds: 1,
    result: RESULT,
    ...output,
  }
  // An output holds a result or a key, never both (./run.ts).
  if (merged.result === undefined) delete merged.result
  instance.snapshot = { status: 'complete', output: merged }
}

describe('POST /api/designs', () => {
  it('creates an instance owned by the caller, kept 30 days (7 on error)', async () => {
    const { status, json } = await submit()
    expect(status).toBe(202)
    expect(json).toMatchObject({ status: 'queued', existing: false })
    const id = json.id as string
    expect(id).toMatch(/^[0-9a-f]{64}$/)

    const instance = workflow.instances.get(id)!
    expect(instance.params.owner).toBe(ADA.owner)
    expect(instance.params.bases).toBe(CDS.length)
    expect(instance.params.request.CDS).toBe(CDS)
    expect(instance.retention).toEqual({
      successRetention: '30 days',
      errorRetention: '7 days',
    })
    expect(limiter.keys).toEqual([`cloud:${ADA.owner}`])
  })

  it('runs exactly the request the browser would run for the same values', async () => {
    // The browser's optimizer and the Workflow step run the same .wasm
    // (its digest is in the id); this pins that they are given the same
    // request, which is what makes the designs the same.
    const values = formValues()
    const { json } = await submit({ values, seed: 1234 })
    const params = buildJobParams(values)
    expect(workflow.instances.get(json.id as string)!.params.request).toEqual({
      ...params,
      options: { ...params.options, seed: 1234 },
    })
  })

  it('returns the existing design for an identical request, without running or spending again', async () => {
    const first = await submit()
    complete(first.json.id as string)
    // Someone else asking for the very same design shares the run.
    const second = await submit({ values: formValues() }, as(BOB))
    expect(second.status).toBe(200)
    expect(second.json).toEqual({
      id: first.json.id,
      status: 'completed',
      existing: true,
    })
    expect(workflow.creates).toBe(1)
    expect(limiter.keys).toHaveLength(1)
  })

  it('gives a different id for a different request', async () => {
    const first = await submit()
    const second = await submit({ values: formValues(), seed: 7 })
    expect(second.json.id).not.toBe(first.json.id)
  })

  it('answers with the winner when an identical submission wins the create race', async () => {
    // Between this request's lookup and its create, another request creates
    // the same id: create() throws "already exists", the dedupe signal.
    let raced = false
    workflow.beforeCreate = (id) => {
      if (raced) return
      raced = true
      workflow.beforeCreate = null
      void workflow.create({
        id,
        params: {
          values: formValues(),
          request: { CDS, name: 'x', options: {} as never },
          owner: BOB.owner,
          bases: CDS.length,
          submittedAt: new Date().toISOString(),
        },
      })
    }
    const { status, json } = await submit()
    expect(status).toBe(200)
    expect(json).toMatchObject({ status: 'queued', existing: true })
    expect(workflow.creates).toBe(1)
  })

  it('restarts a design that failed transiently, and spends the budget for it', async () => {
    const { json } = await submit()
    const instance = workflow.instances.get(json.id as string)!
    instance.snapshot = {
      status: 'errored',
      error: { name: 'Error', message: 'Network connection lost.' },
    }
    const again = await submit()
    expect(again.json).toMatchObject({ status: 'queued', existing: true })
    expect(instance.restarts).toBe(1)
    expect(limiter.keys).toHaveLength(2)
  })

  it.each([
    ['ran out of CPU', 'Error: Worker exceeded CPU time limit.'],
    ['was refused by the optimizer', 'invalid_input: no WGGW motif'],
  ])('does not re-run a design that %s', async (_, message) => {
    const { json } = await submit()
    const instance = workflow.instances.get(json.id as string)!
    instance.snapshot = { status: 'errored', error: { name: 'Error', message } }
    const again = await submit()
    expect(again.json).toMatchObject({ status: 'failed', existing: true })
    expect(instance.restarts).toBe(0)
  })

  it('refuses a design the form would refuse, with the form’s reason', async () => {
    const { status, json } = await submit({
      values: formValues({ codingSequence: 'ATGAAATAG'.slice(0, 7) }),
    })
    expect(status).toBe(400)
    expect(json.message).toMatch(/codingSequence: .*multiple of 3/)
    expect(workflow.creates).toBe(0)
  })

  it('refuses a sequence over the cloud cap', async () => {
    const long = `ATG${'AAA'.repeat(CLOUD_DESIGN_MAX_BASES / 3)}TAA`
    const { status, json } = await submit({
      values: formValues({ codingSequence: long }),
    })
    expect(status).toBe(413)
    expect(json.message).toMatch(/45,000/)
    expect(workflow.creates).toBe(0)
  })

  it('refuses input that is not a submission at all', async () => {
    const { status, json } = await submit('nope')
    expect(status).toBe(400)
    expect(json).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('checks who is asking before looking at the input', async () => {
    expect((await submit('nope', as(NOBODY))).json.reason).toBe('unauthorized')
  })

  it('refuses over the per-owner budget, with Retry-After', async () => {
    limiter = fakeLimiter(1)
    env = { ...env, DESIGN_LIMITER: limiter.binding }
    await submit()
    const { status, json } = await submit({ values: formValues(), seed: 2 })
    expect(status).toBe(429)
    expect(json.retryAfter).toBe(60)
    expect(workflow.creates).toBe(1)
  })

  it('answers 503 when the Workflow is not bound', async () => {
    const { status } = await submit(
      undefined,
      as(ADA, { ...GATE, ...ACCOUNTS, AUTH_DB: accounts.binding }),
    )
    expect(status).toBe(503)
  })

  it('answers 401 without a session, and creates nothing', async () => {
    const { status } = await submit(undefined, as(NOBODY))
    expect(status).toBe(401)
    expect(workflow.creates).toBe(0)
  })

  it('answers 401 for a session signed under another passcode', async () => {
    const changed = as(ADA, { ...env, BASIC_AUTH_PASSWORD: 'rotated' })
    const { status } = await submit(undefined, changed)
    expect(status).toBe(401)
  })

  it('answers 503 with the passcode half-configured, and creates nothing', async () => {
    const { status } = await submit(
      undefined,
      as(ADA, {
        DESIGN_WORKFLOW: workflow.binding(),
        BASIC_AUTH_PASSWORD: 'x',
      }),
    )
    expect(status).toBe(503)
    expect(workflow.creates).toBe(0)
  })

  it('needs an account: past the passcode alone is not enough', async () => {
    const { status, json } = await submit(undefined, as(PASSCODE_ONLY))
    expect(status).toBe(401)
    expect(json).toMatchObject({ ok: false, reason: 'account_required' })
    expect(workflow.creates).toBe(0)
  })

  it('refuses for lack of an account before looking at the input', async () => {
    expect((await submit('nope', as(PASSCODE_ONLY))).json.reason).toBe(
      'account_required',
    )
  })

  it('needs an account in local development with no passcode too', async () => {
    const local = {
      DESIGN_WORKFLOW: workflow.binding(),
      AUTH_DB: accounts.binding,
    }
    const signedOut = as(NOBODY, local)
    expect((await submit(undefined, signedOut)).json.reason).toBe(
      'account_required',
    )
    // Signed in locally (no passcode, the local accounts secret), the
    // account owns it.
    const { cookie, userId } = await signInWithCode(
      {
        ...local,
        AUTH_EMAIL: mailbox.binding,
        AUTH_EMAIL_FROM: 'a@rejstudio.com',
      },
      mailbox,
      'local@example.com',
      SITE,
    )
    const { status, json } = await submit(
      undefined,
      as({ owner: `user:${userId}`, cookie }, local),
    )
    expect(status).toBe(202)
    expect(workflow.instances.get(json.id as string)!.params.owner).toBe(
      `user:${userId}`,
    )
  })

  it('treats accounts as off, and refuses, when the database is not bound', async () => {
    const { json } = await submit(
      undefined,
      as(ADA, { ...env, AUTH_DB: undefined }),
    )
    expect(json.reason).toBe('account_required')
  })
})

describe('My cloud designs', () => {
  it('lists what the account submitted, newest first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-11-01T10:00:00Z'))
      const { json: first } = await submit({
        values: formValues({ name: 'First' }),
      })
      vi.setSystemTime(new Date('2026-11-02T10:00:00Z'))
      const { json: second } = await submit({
        values: formValues({ name: 'Second' }),
      })
      const { status, json } = await list()
      expect(status).toBe(200)
      expect(json).toEqual([
        {
          id: second.id,
          name: 'Second',
          bases: CDS.length,
          submittedAt: '2026-11-02T10:00:00.000Z',
        },
        {
          id: first.id,
          name: 'First',
          bases: CDS.length,
          submittedAt: '2026-11-01T10:00:00.000Z',
        },
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('lists one entry for a resubmitted design, and each account its own', async () => {
    await submit()
    await submit()
    await submit(undefined, as(BOB))
    expect(await list()).toMatchObject({ status: 200 })
    expect((await list()).json).toHaveLength(1)
    // Bob submitted the identical design: the same run, on his list too.
    const bobs = (await list(as(BOB))).json as unknown as { id: string }[]
    expect(bobs.map((one) => one.id)).toEqual(
      ((await list()).json as unknown as { id: string }[]).map((one) => one.id),
    )
    expect(workflow.creates).toBe(1)
  })

  it('keeps one account’s designs off another’s list', async () => {
    await submit()
    expect((await list(as(BOB))).json).toEqual([])
  })

  it('drops a design from the list when it is deleted', async () => {
    const { json: submitted } = await submit()
    complete(submitted.id as string)
    expect((await remove(submitted.id as string)).status).toBe(200)
    expect((await list()).json).toEqual([])
  })

  it('drops a design that is already gone from the cloud', async () => {
    const { json: submitted } = await submit()
    workflow.instances.get(submitted.id as string)!.deleted = true
    expect((await remove(submitted.id as string)).status).toBe(404)
    expect((await list()).json).toEqual([])
  })

  it('needs an account', async () => {
    const { status, json } = await list(as(PASSCODE_ONLY))
    expect(status).toBe(401)
    expect(json.reason).toBe('account_required')
  })

  it('still submits when the list cannot be written', async () => {
    const broken = failingD1(accounts.binding, (sql) =>
      sql.includes('cloud_design'),
    )
    const { status } = await submit(
      undefined,
      as(ADA, { ...env, AUTH_DB: broken }),
    )
    expect(status).toBe(202)
  })
})

describe('GET /api/designs/:id', () => {
  it('reports a queued design by id alone', async () => {
    const { json: submitted } = await submit()
    const { status, json } = await read(submitted.id as string)
    expect(status).toBe(200)
    expect(json).toEqual({ id: submitted.id, status: 'queued' })
  })

  it('reports a running design with its inputs', async () => {
    const { json: submitted } = await submit()
    workflow.instances.get(submitted.id as string)!.snapshot = {
      status: 'running',
    }
    const { json } = await read(submitted.id as string)
    expect(json).toMatchObject({
      status: 'running',
      name: 'Cloud test',
      bases: CDS.length,
      owner: ADA.owner,
      ownedByCaller: true,
    })
  })

  it('returns a finished design to anyone signed in, not only its owner', async () => {
    const { json: submitted } = await submit()
    complete(submitted.id as string)
    const { status, json } = await read(submitted.id as string, as(BOB))
    expect(status).toBe(200)
    // The browser parses it with this schema; so must the test.
    const design = cloudDesignSchema.parse(json)
    expect(design).toMatchObject({
      status: 'completed',
      owner: ADA.owner,
      ownedByCaller: false,
    })
    expect(design.result?.optimized_sequence).toBe(CDS)
    expect(design.values?.codingSequence).toBe(CDS)
  })

  it('reads a large result back from R2', async () => {
    const bucket = fakeBucket()
    env = { ...env, DESIGN_RESULTS: bucket.binding }
    const { json: submitted } = await submit()
    const id = submitted.id as string
    bucket.objects.set(resultKey(id), JSON.stringify(RESULT))
    complete(id, { resultKey: resultKey(id), result: undefined })
    const { json } = await read(id)
    expect(cloudDesignSchema.parse(json).result?.seq5).toBe(RESULT.seq5)
  })

  it('reports a design that ran out of CPU as too large for the cloud', async () => {
    const { json: submitted } = await submit()
    workflow.instances.get(submitted.id as string)!.snapshot = {
      status: 'errored',
      error: { name: 'Error', message: 'Worker exceeded CPU time limit.' },
    }
    const { json } = await read(submitted.id as string)
    expect(json).toMatchObject({
      status: 'failed',
      error: { code: 'too_large', retriable: false },
    })
    expect((json.error as { message: string }).message).toMatch(
      /too large for the cloud.*browser/i,
    )
  })

  it('answers 404 for an unknown id and for something that is not an id', async () => {
    expect((await read('a'.repeat(64))).status).toBe(404)
    expect((await read('browser-123')).status).toBe(404)
  })

  it('needs an identity like everything else', async () => {
    const { json: submitted } = await submit()
    const { status } = await read(submitted.id as string, as(NOBODY))
    expect(status).toBe(401)
  })

  it('opens for someone past the passcode without an account, who owns nothing', async () => {
    const { json: submitted } = await submit()
    complete(submitted.id as string)
    const { status, json } = await read(
      submitted.id as string,
      as(PASSCODE_ONLY),
    )
    expect(status).toBe(200)
    expect(json).toMatchObject({ status: 'completed', ownedByCaller: false })
  })

  it('tells the owning account it owns the design', async () => {
    const { json: submitted } = await submit()
    complete(submitted.id as string)
    expect((await read(submitted.id as string)).json.ownedByCaller).toBe(true)
    expect(
      (await read(submitted.id as string, as(BOB))).json.ownedByCaller,
    ).toBe(false)
  })

  describe('when the Workflow binding stumbles on a read', () => {
    // The deployed binding answers get() and status() with a bare "internal
    // error" for about a second after create(); the service retries both.
    function failStatus(id: string, times: number) {
      const instance = workflow.instances.get(id)!
      const real = instance.status
      let failures = 0
      instance.status = async () => {
        if (failures++ < times) throw new Error('internal error')
        return real()
      }
    }

    it('retries and answers once the binding recovers', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        const { json: submitted } = await submit()
        failStatus(submitted.id as string, STATUS_RETRY_DELAYS_MS.length)
        const { status, json } = await settle(read(submitted.id as string))
        expect(status).toBe(200)
        expect(json).toEqual({ id: submitted.id, status: 'queued' })
      } finally {
        vi.useRealTimers()
      }
    })

    it('retries a stumbling get() too', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        const { json: submitted } = await submit()
        const real = workflow.get
        let failures = 0
        workflow.get = async (id) => {
          if (failures++ < 2) throw new Error('internal error')
          return real(id)
        }
        const { status } = await settle(read(submitted.id as string))
        expect(status).toBe(200)
      } finally {
        vi.useRealTimers()
      }
    })

    it('still answers 404 at once for an id that does not exist', async () => {
      const { status } = await read('f'.repeat(64))
      expect(status).toBe(404)
    })

    it('asks the client to retry, not fail, when it does not recover', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        const { json: submitted } = await submit()
        failStatus(submitted.id as string, Infinity)
        const { status, json } = await settle(read(submitted.id as string))
        expect(status).toBe(503)
        expect(json).toMatchObject({ reason: 'busy', retryAfter: 2 })
      } finally {
        vi.useRealTimers()
      }
    })
  })
})

describe('DELETE /api/designs/:id', () => {
  it('lets the owner delete a design and its stored result', async () => {
    const bucket = fakeBucket()
    env = { ...env, DESIGN_RESULTS: bucket.binding }
    const { json: submitted } = await submit()
    const id = submitted.id as string
    bucket.objects.set(resultKey(id), JSON.stringify(RESULT))
    complete(id, { resultKey: resultKey(id), result: undefined })

    expect((await remove(id)).status).toBe(200)
    expect(workflow.instances.get(id)!.deleted).toBe(true)
    expect(bucket.objects.size).toBe(0)
    expect((await read(id)).status).toBe(404)
  })

  it('refuses anyone but the owner', async () => {
    const { json: submitted } = await submit()
    complete(submitted.id as string)
    expect((await remove(submitted.id as string, as(BOB))).status).toBe(403)
    expect(workflow.instances.get(submitted.id as string)!.deleted).toBe(false)
  })

  it('checks the owner of a design that is still running or failed', async () => {
    const { json: submitted } = await submit()
    const id = submitted.id as string
    workflow.instances.get(id)!.snapshot = {
      status: 'errored',
      error: { name: 'Error', message: 'invalid_input: nope' },
    }
    expect((await remove(id, as(BOB))).status).toBe(403)
    expect((await remove(id)).status).toBe(200)
  })

  it('refuses, for now, a design that has not started and so has no known owner', async () => {
    const { json: submitted } = await submit()
    const { status, json } = await remove(submitted.id as string)
    expect(status).toBe(409)
    expect(json).toMatchObject({ reason: 'not_started', retryAfter: 5 })
  })

  it('answers 404 for an unknown design', async () => {
    expect((await remove('b'.repeat(64))).status).toBe(404)
  })

  it('needs an account', async () => {
    const { json: submitted } = await submit()
    complete(submitted.id as string)
    const { status, json } = await remove(
      submitted.id as string,
      as(PASSCODE_ONLY),
    )
    expect(status).toBe(401)
    expect(json.reason).toBe('account_required')
    expect(workflow.instances.get(submitted.id as string)!.deleted).toBe(false)
  })

  it('reads, but does not let an account delete, a design a passcode session owned before accounts', async () => {
    // Submitted under the old rule: owned by the browser's passcode session.
    const { json: submitted } = await submit()
    const id = submitted.id as string
    const instance = workflow.instances.get(id)!
    ;(instance.params as { owner: string }).owner =
      `session:${PASSCODE_ONLY.sid}`
    complete(id)
    expect((await read(id, as(PASSCODE_ONLY))).json).toMatchObject({
      status: 'completed',
      owner: `session:${PASSCODE_ONLY.sid}`,
      ownedByCaller: false,
    })
    expect((await remove(id)).status).toBe(403)
    expect((await remove(id, as(PASSCODE_ONLY))).status).toBe(401)
    expect(instance.deleted).toBe(false)
  })
})

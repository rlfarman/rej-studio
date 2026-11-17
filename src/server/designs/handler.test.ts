// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// The optimizer's module is WebAssembly imported the Cloudflare way, which
// only instantiates in workerd; nothing here runs a design.
vi.mock('../mcp/optimizer', () => ({ designOnWorker: vi.fn() }))

import {
  CLOUD_DESIGN_MAX_BASES,
  cloudDesignSchema,
} from '@/features/design-tool/types/cloud-design'

import {
  gateConfig,
  SESSION_COOKIE_NAME,
  signSession,
  verifySession,
} from '../auth/session'
import type { ServerEnv } from '../env'
import {
  authorize,
  createDesign,
  getDesign,
  MAX_BODY_BYTES,
  parseDesignId,
  parseSubmission,
  refuseOversizedBody,
  removeDesign,
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

// The cloud-design server functions' server side, through the real handler
// pieces and service, against an in-memory Workflow binding. Each call runs
// the pieces in the order the server function does (identity, then the
// validator, then the handler; ../../features/design-tool/api/
// cloud-designs.functions.ts), and a thrown refusal is read as the HTTP
// answer Start sends for it. Identity is a real session cookie signed under
// the passcode, so a test switches who is asking by sending another
// caller's cookie.

const BASE = 'http://localhost:3000/api/fn/cloud-designs.fn'
const GATE = {
  BASIC_AUTH_PASSWORD: 'splice-test',
  SESSION_SECRET: 'a-test-session-secret-of-at-least-32-chars',
}

interface Caller {
  owner: string
  cookie: string
}

async function signIn(): Promise<Caller> {
  const config = gateConfig(GATE)
  if (config.mode !== 'on') throw new Error('test gate is not on')
  const token = await signSession(config)
  const session = await verifySession(config, token)
  return {
    owner: `session:${session!.sid}`,
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
  }
}

let ADA: Caller
let BOB: Caller

beforeAll(async () => {
  ADA = await signIn()
  BOB = await signIn()
})

let workflow: FakeWorkflow
let limiter: ReturnType<typeof fakeLimiter>
let env: ServerEnv

/** Which caller each env stands for: a request built for it carries their cookie. */
const callers = new WeakMap<ServerEnv, Caller>()

beforeEach(() => {
  workflow = new FakeWorkflow()
  limiter = fakeLimiter()
  env = {
    DESIGN_WORKFLOW: workflow.binding(),
    DESIGN_LIMITER: limiter.binding,
    ...GATE,
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

/** What the client receives: the status, headers and JSON body. */
interface Answer {
  status: number
  headers: Headers
  json: Record<string, unknown>
}

/**
 * Runs one server-function call: who is asking, then `body`. A thrown
 * `Response` is a refusal, sent by Start as it is.
 */
async function answer(
  e: ServerEnv,
  method: string,
  body: (owner: string) => Promise<{ status: number; data: unknown }>,
): Promise<Answer> {
  const request = new Request(BASE, { method, headers: headersFor(e) })
  try {
    const owner = await authorize(request, e)
    const { status, data } = await body(owner)
    return {
      status,
      headers: new Headers(),
      json: (data ?? {}) as Record<string, unknown>,
    }
  } catch (error) {
    if (!(error instanceof Response)) throw error
    return {
      status: error.status,
      headers: error.headers,
      json: (await error.json()) as Record<string, unknown>,
    }
  }
}

function submit(input: unknown = { values: formValues() }, e = env) {
  return answer(e, 'POST', async (owner) => {
    const { answer: data, created } = await createDesign(
      e,
      owner,
      parseSubmission(input),
    )
    return { status: created ? 202 : 200, data }
  })
}

function read(id: string, e = env) {
  return answer(e, 'GET', async (owner) => ({
    status: 200,
    data: await getDesign(e, owner, parseDesignId({ id }).id),
  }))
}

function remove(id: string, e = env) {
  return answer(e, 'POST', async (owner) => ({
    status: 200,
    data: await removeDesign(e, owner, parseDesignId({ id }).id),
  }))
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

describe('submitCloudDesignFn', () => {
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
    expect(json.error).toMatch(/codingSequence: .*multiple of 3/)
    expect(workflow.creates).toBe(0)
  })

  it('refuses a sequence over the cloud cap', async () => {
    const long = `ATG${'AAA'.repeat(CLOUD_DESIGN_MAX_BASES / 3)}TAA`
    const { status, json } = await submit({
      values: formValues({ codingSequence: long }),
    })
    expect(status).toBe(413)
    expect(json.error).toMatch(/45,000/)
    expect(workflow.creates).toBe(0)
  })

  it('refuses input that is not a submission at all', async () => {
    const { status, headers } = await submit('nope')
    expect(status).toBe(400)
    expect(headers.get('cache-control')).toBe('no-store')
  })

  it('checks who is asking before looking at the input', async () => {
    expect((await submit('nope', as(NOBODY))).status).toBe(401)
  })

  it('refuses over the per-owner budget, with Retry-After', async () => {
    limiter = fakeLimiter(1)
    env = { ...env, DESIGN_LIMITER: limiter.binding }
    await submit()
    const { status, headers } = await submit({ values: formValues(), seed: 2 })
    expect(status).toBe(429)
    expect(headers.get('retry-after')).toBe('60')
    expect(workflow.creates).toBe(1)
  })

  it('answers 503 when the Workflow is not bound', async () => {
    const { status } = await submit(undefined, as(ADA, { ...GATE }))
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

  it('treats local development with no passcode as one local owner', async () => {
    const { status, json } = await submit(undefined, {
      DESIGN_WORKFLOW: workflow.binding(),
    })
    expect(status).toBe(202)
    expect(workflow.instances.get(json.id as string)!.params.owner).toBe(
      'local',
    )
  })
})

describe('readCloudDesignFn', () => {
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
        const { status, headers } = await settle(read(submitted.id as string))
        expect(status).toBe(503)
        expect(headers.get('retry-after')).toBe('2')
      } finally {
        vi.useRealTimers()
      }
    })
  })
})

describe('deleteCloudDesignFn', () => {
  it('lets the owner delete a design and its stored result', async () => {
    const bucket = fakeBucket()
    env = { ...env, DESIGN_RESULTS: bucket.binding }
    const { json: submitted } = await submit()
    const id = submitted.id as string
    bucket.objects.set(resultKey(id), JSON.stringify(RESULT))
    complete(id, { resultKey: resultKey(id), result: undefined })

    const { status } = await remove(id)
    expect(status).toBe(200)
    expect(workflow.instances.get(id)!.deleted).toBe(true)
    expect(bucket.objects.size).toBe(0)
    expect((await read(id)).status).toBe(404)
  })

  it('refuses anyone but the owner', async () => {
    const { json: submitted } = await submit()
    complete(submitted.id as string)
    const { status } = await remove(submitted.id as string, as(BOB))
    expect(status).toBe(403)
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
    const { status, headers } = await remove(submitted.id as string)
    expect(status).toBe(409)
    expect(headers.get('retry-after')).toBe('5')
  })

  it('answers 404 for an unknown design', async () => {
    expect((await remove('b'.repeat(64))).status).toBe(404)
  })
})

describe('the body cap', () => {
  function upload(bytes: number, declare: boolean) {
    const chunk = new Uint8Array(bytes)
    return new Request(BASE, {
      method: 'POST',
      // A stream has no declared length: the chunked case.
      body: declare
        ? chunk
        : new ReadableStream({
            start(controller) {
              controller.enqueue(chunk)
              controller.close()
            },
          }),
      ...(declare
        ? { headers: { 'content-length': String(bytes) } }
        : { duplex: 'half' }),
    } as RequestInit)
  }

  it.each([true, false])(
    'refuses a body over the cap (declared length: %s)',
    async (declare) => {
      const refusal = await refuseOversizedBody(
        upload(MAX_BODY_BYTES + 1, declare),
      )
      expect(refusal?.status).toBe(413)
    },
  )

  it.each([true, false])(
    'lets a body within the cap through, still readable (declared length: %s)',
    async (declare) => {
      const request = upload(MAX_BODY_BYTES, declare)
      expect(await refuseOversizedBody(request)).toBeNull()
      expect((await request.arrayBuffer()).byteLength).toBe(MAX_BODY_BYTES)
    },
  )

  it('lets a request with no body through', async () => {
    expect(await refuseOversizedBody(new Request(BASE))).toBeNull()
  })
})

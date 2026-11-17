// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// The optimizer's module is WebAssembly imported the Cloudflare way, which
// only instantiates in workerd; nothing here runs a design.
vi.mock('../mcp/optimizer', () => ({ designOnWorker: vi.fn() }))

import {
  CLOUD_DESIGN_MAX_BASES,
  cloudDesignSchema,
} from '@/features/design-tool/types/cloud-design'

import type { ServerEnv } from '../env'
import {
  handleCreateDesign,
  handleDeleteDesign,
  handleGetDesign,
} from './handler'
import { resultKey, type CloudDesignOutput } from './run'
import {
  CDS,
  fakeBucket,
  fakeLimiter,
  FakeWorkflow,
  formValues,
  RESULT,
} from './test-utils'

// The HTTP surface of /api/designs, through the real handlers and service,
// against an in-memory Workflow binding. Identity comes from
// DEV_ACCESS_EMAIL on a loopback URL — the Access JWT itself is covered in
// access.test.ts — so a test can switch who is asking by changing it.

const BASE = 'http://localhost:3000/api/designs'
const ADA = 'ada@lab.example'
const BOB = 'bob@lab.example'

let workflow: FakeWorkflow
let limiter: ReturnType<typeof fakeLimiter>
let env: ServerEnv

beforeEach(() => {
  workflow = new FakeWorkflow()
  limiter = fakeLimiter()
  env = {
    DESIGN_WORKFLOW: workflow.binding(),
    DESIGN_LIMITER: limiter.binding,
    DEV_ACCESS_EMAIL: ADA,
  }
})

function as(email: string): ServerEnv {
  return { ...env, DEV_ACCESS_EMAIL: email }
}

function post(body: unknown, init: RequestInit = {}) {
  return new Request(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  })
}

async function submit(body: unknown = { values: formValues() }, e = env) {
  const response = await handleCreateDesign(post(body), e)
  return { response, json: (await response.json()) as Record<string, unknown> }
}

async function read(id: string, e = env) {
  const response = await handleGetDesign(new Request(`${BASE}/${id}`), e, id)
  return { response, json: (await response.json()) as Record<string, unknown> }
}

function remove(id: string, e = env) {
  return handleDeleteDesign(
    new Request(`${BASE}/${id}`, { method: 'DELETE' }),
    e,
    id,
  )
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
    const { response, json } = await submit()
    expect(response.status).toBe(202)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(json).toMatchObject({ status: 'queued', existing: false })
    const id = json.id as string
    expect(id).toMatch(/^[0-9a-f]{64}$/)
    expect(response.headers.get('location')).toBe(`/api/designs/${id}`)

    const instance = workflow.instances.get(id)!
    expect(instance.params.owner).toBe(ADA)
    expect(instance.params.bases).toBe(CDS.length)
    expect(instance.params.request.CDS).toBe(CDS)
    expect(instance.retention).toEqual({
      successRetention: '30 days',
      errorRetention: '7 days',
    })
    expect(limiter.keys).toEqual([`cloud:${ADA}`])
  })

  it('returns the existing design for an identical request, without running or spending again', async () => {
    const first = await submit()
    complete(first.json.id as string)
    // Someone else asking for the very same design shares the run.
    const second = await submit({ values: formValues() }, as(BOB))
    expect(second.response.status).toBe(200)
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
          owner: BOB,
          bases: CDS.length,
          submittedAt: new Date().toISOString(),
        },
      })
    }
    const { response, json } = await submit()
    expect(response.status).toBe(200)
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
    const { response, json } = await submit({
      values: formValues({ codingSequence: 'ATGAAATAG'.slice(0, 7) }),
    })
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/codingSequence: .*multiple of 3/)
    expect(workflow.creates).toBe(0)
  })

  it('refuses a sequence over the cloud cap', async () => {
    const long = `ATG${'AAA'.repeat(CLOUD_DESIGN_MAX_BASES / 3)}TAA`
    const { response, json } = await submit({
      values: formValues({ codingSequence: long }),
    })
    expect(response.status).toBe(413)
    expect(json.error).toMatch(/45,000/)
    expect(workflow.creates).toBe(0)
  })

  it('refuses an oversized body before parsing it', async () => {
    const response = await handleCreateDesign(post('x'.repeat(300_000)), env)
    expect(response.status).toBe(413)
  })

  it('refuses a body that is not JSON', async () => {
    const response = await handleCreateDesign(post('{nope'), env)
    expect(response.status).toBe(400)
  })

  it('refuses over the per-owner budget, with Retry-After', async () => {
    limiter = fakeLimiter(1)
    env = { ...env, DESIGN_LIMITER: limiter.binding }
    await submit()
    const { response } = await submit({ values: formValues(), seed: 2 })
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(workflow.creates).toBe(1)
  })

  it('answers 503 when the Workflow is not bound', async () => {
    const { response } = await submit(undefined, {
      DEV_ACCESS_EMAIL: ADA,
    })
    expect(response.status).toBe(503)
  })

  it('answers 503 with no identity configured, and creates nothing', async () => {
    const { response } = await submit(undefined, {
      DESIGN_WORKFLOW: workflow.binding(),
    })
    expect(response.status).toBe(503)
    expect(workflow.creates).toBe(0)
  })
})

describe('GET /api/designs/:id', () => {
  it('reports a queued design by id alone', async () => {
    const { json: submitted } = await submit()
    const { response, json } = await read(submitted.id as string)
    expect(response.status).toBe(200)
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
      owner: ADA,
      ownedByCaller: true,
    })
  })

  it('returns a finished design to anyone signed in, not only its owner', async () => {
    const { json: submitted } = await submit()
    complete(submitted.id as string)
    const { response, json } = await read(submitted.id as string, as(BOB))
    expect(response.status).toBe(200)
    // The browser parses it with this schema; so must the test.
    const design = cloudDesignSchema.parse(json)
    expect(design).toMatchObject({
      status: 'completed',
      owner: ADA,
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
    expect((await read('a'.repeat(64))).response.status).toBe(404)
    expect((await read('browser-123')).response.status).toBe(404)
  })

  it('needs an identity like everything else', async () => {
    const { json: submitted } = await submit()
    const { response } = await read(submitted.id as string, {
      DESIGN_WORKFLOW: workflow.binding(),
    })
    expect(response.status).toBe(503)
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

    const response = await remove(id)
    expect(response.status).toBe(204)
    expect(workflow.instances.get(id)!.deleted).toBe(true)
    expect(bucket.objects.size).toBe(0)
    expect((await read(id)).response.status).toBe(404)
  })

  it('refuses anyone but the owner', async () => {
    const { json: submitted } = await submit()
    complete(submitted.id as string)
    const response = await remove(submitted.id as string, as(BOB))
    expect(response.status).toBe(403)
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
    expect((await remove(id)).status).toBe(204)
  })

  it('refuses, for now, a design that has not started and so has no known owner', async () => {
    const { json: submitted } = await submit()
    const response = await remove(submitted.id as string)
    expect(response.status).toBe(409)
  })

  it('answers 404 for an unknown design', async () => {
    expect((await remove('b'.repeat(64))).status).toBe(404)
  })
})

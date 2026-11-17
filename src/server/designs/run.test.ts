// @vitest-environment node
import { describe, expect, it, vi } from 'vite-plus/test'

vi.mock('../mcp/optimizer', () => ({ designOnWorker: vi.fn() }))

import {
  CloudDesignFailure,
  MAX_INLINE_RESULT_BYTES,
  resultKey,
  runCloudDesign,
  type CloudDesignParams,
} from './run'
import { cloudStatus, describeFailure } from './service'
import { CDS, fakeBucket, formValues, RESULT } from './test-utils'

const ID = 'c'.repeat(64)

const PARAMS: CloudDesignParams = {
  values: formValues(),
  request: { CDS, name: 'Cloud test', options: {} as never },
  owner: 'ada@lab.example',
  bases: CDS.length,
  submittedAt: '2026-11-16T00:00:00.000Z',
}

const ok = (result = RESULT) =>
  vi.fn().mockResolvedValue({ ok: true, result, seconds: 1.5 })

/** A result whose JSON is over the inline limit. */
const HUGE = {
  ...RESULT,
  objectives_before: 'x'.repeat(MAX_INLINE_RESULT_BYTES),
}

describe('runCloudDesign', () => {
  it('runs the request it was given and returns the result inline', async () => {
    const design = ok()
    const output = await runCloudDesign(ID, PARAMS, {}, { design })
    expect(design).toHaveBeenCalledWith(PARAMS.request)
    expect(output).toEqual({
      values: PARAMS.values,
      owner: PARAMS.owner,
      bases: PARAMS.bases,
      submittedAt: PARAMS.submittedAt,
      seconds: 1.5,
      result: RESULT,
    })
  })

  it.each([
    ['invalid_input', 'invalid_input'],
    ['backend', 'optimizer_failed'],
  ] as const)(
    'turns an optimizer %s into a %s failure, which is not retried',
    async (code, expected) => {
      const design = vi
        .fn()
        .mockResolvedValue({ ok: false, code, message: 'no WGGW motif' })
      const run = runCloudDesign(ID, PARAMS, {}, { design })
      await expect(run).rejects.toBeInstanceOf(CloudDesignFailure)
      await expect(run).rejects.toMatchObject({ code: expected })
    },
  )

  it('writes a result too large to return to R2, and returns its key', async () => {
    const bucket = fakeBucket()
    const output = await runCloudDesign(
      ID,
      PARAMS,
      { DESIGN_RESULTS: bucket.binding },
      { design: ok(HUGE) },
    )
    expect(output).toMatchObject({ resultKey: resultKey(ID) })
    expect('result' in output).toBe(false)
    expect(JSON.parse(bucket.objects.get(resultKey(ID))!)).toEqual(HUGE)
  })

  it('retries a failed R2 write without re-running the design', async () => {
    const bucket = fakeBucket()
    const put = vi
      .fn()
      .mockRejectedValueOnce(new Error('R2 hiccup'))
      .mockImplementation(async (key: string, value: string) => {
        bucket.objects.set(key, value)
      })
    const design = ok(HUGE)
    const wait = vi.fn().mockResolvedValue(undefined)
    await runCloudDesign(
      ID,
      PARAMS,
      { DESIGN_RESULTS: { ...bucket.binding, put } as R2Bucket },
      { design, wait },
    )
    expect(put).toHaveBeenCalledTimes(2)
    expect(design).toHaveBeenCalledOnce()
    expect(wait).toHaveBeenCalledWith(1000)
  })

  it('fails clearly when a large result has no bucket to go to', async () => {
    const run = runCloudDesign(ID, PARAMS, {}, { design: ok(HUGE) })
    await expect(run).rejects.toMatchObject({
      code: 'result_too_large',
      message: expect.stringMatching(/DESIGN_RESULTS/),
    })
  })
})

describe('describeFailure', () => {
  // The CPU limit cannot be hit locally (workerd under `wrangler dev` does
  // not enforce it), so its mapping is pinned here against the message the
  // runtime records.
  it.each([
    'Worker exceeded CPU time limit.',
    'Error: Worker exceeded CPU time limit.',
    'exceededCpu',
  ])('reports %j as too large for the cloud, not retriable', (message) => {
    const failure = describeFailure({ name: 'Error', message })
    expect(failure).toMatchObject({ code: 'too_large', retriable: false })
    expect(failure.message).toMatch(/too large for the cloud.*browser/i)
  })

  it('reads the step’s own codes from the message, as status() reports them', () => {
    expect(
      describeFailure({ name: 'Error', message: 'invalid_input: no motif' }),
    ).toEqual({ code: 'invalid_input', message: 'no motif', retriable: false })
    expect(
      describeFailure({
        name: 'Error',
        message: 'NonRetryableError: optimizer_failed: panicked',
      }),
    ).toEqual({ code: 'backend', message: 'panicked', retriable: false })
    expect(
      describeFailure({ name: 'Error', message: 'result_too_large: big' }),
    ).toMatchObject({ code: 'backend', retriable: false })
  })

  it('treats anything else as transient, so resubmitting re-runs it', () => {
    expect(
      describeFailure({ name: 'Error', message: 'Network connection lost.' }),
    ).toMatchObject({ code: 'backend', retriable: true })
    expect(describeFailure(undefined)).toMatchObject({ retriable: true })
  })
})

describe('cloudStatus', () => {
  it.each([
    ['queued', 'queued'],
    ['paused', 'queued'],
    ['unknown', 'queued'],
    ['running', 'running'],
    ['waiting', 'running'],
    ['complete', 'completed'],
    ['errored', 'failed'],
    ['terminated', 'failed'],
  ] as const)('%s → %s', (status, expected) => {
    expect(cloudStatus(status)).toBe(expected)
  })
})

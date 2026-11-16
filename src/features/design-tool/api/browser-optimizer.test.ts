import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import type {
  OptimizerRequest,
  OptimizerResponse,
} from '@/features/design-tool/workers/optimizer-protocol'

// A stand-in for the real worker. The WebAssembly module itself is covered by
// the Rust suite and scripts/wasm-smoke.mjs; what matters here is the
// plumbing around it — progress, cancellation, validation and failure paths.
class FakeWorker implements Partial<Worker> {
  static instances: FakeWorker[] = []

  terminated = false
  posted: OptimizerRequest[] = []
  private listeners = new Map<string, Set<EventListener>>()

  constructor() {
    FakeWorker.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener) {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener)
  }

  postMessage(request: OptimizerRequest) {
    this.posted.push(request)
  }

  terminate() {
    this.terminated = true
  }

  /** Deliver a message as the real worker would. */
  emit(message: OptimizerResponse) {
    const event = { data: message } as MessageEvent<OptimizerResponse>
    for (const listener of this.listeners.get('message') ?? []) {
      listener(event as unknown as Event)
    }
  }

  /** Deliver a worker-level crash. */
  crash(message = 'boom') {
    const event = { error: new Error(message) } as ErrorEvent
    for (const listener of this.listeners.get('error') ?? []) {
      listener(event as unknown as Event)
    }
  }

  /** The run id the client generated for the latest request. */
  get runId(): string {
    const latest = this.posted.at(-1)
    if (!latest) throw new Error('nothing was posted to the worker')
    return latest.runId
  }
}

vi.stubGlobal('Worker', FakeWorker)

import {
  browserOptimizerSupported,
  designInBrowser,
  terminateOptimizerWorker,
  warmOptimizerWorker,
} from './browser-optimizer'

/** A result shaped like the backend contract, which the client re-validates. */
function validResult(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test',
    original_sequence: 'ATGTGA',
    optimized_sequence: 'ATGTGA',
    seq5: '[REJ5]ATG',
    seq3: 'TGA[REJ3]',
    split_point: 3,
    used_wggw_as_split: false,
    objectives_before: 'before',
    objectives_after: 'after',
    objectives_report_before: { entries: [], total_score: null },
    objectives_report_after: { entries: [], total_score: null },
    wggw_info: null,
    processing_time_seconds: 0.1,
    seed: 1234,
    ...overrides,
  }
}

/** Let the client attach its listeners before the fake worker replies. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

async function startDesign(
  options: Parameters<typeof designInBrowser>[1] = {},
) {
  const pending = designInBrowser(
    { CDS: 'ATGTGA', name: 'test', options: {} as never },
    options,
  )
  await flush()
  const worker = FakeWorker.instances.at(-1)
  if (!worker) throw new Error('no worker was created')
  return { pending, worker }
}

beforeEach(() => {
  FakeWorker.instances = []
  terminateOptimizerWorker()
})

afterEach(() => {
  terminateOptimizerWorker()
})

describe('browserOptimizerSupported', () => {
  it('is true when the browser has Workers and WebAssembly', () => {
    expect(browserOptimizerSupported()).toBe(true)
  })

  it('is false without Worker support', () => {
    vi.stubGlobal('Worker', undefined)
    expect(browserOptimizerSupported()).toBe(false)
    vi.stubGlobal('Worker', FakeWorker)
  })
})

describe('designInBrowser', () => {
  it('posts the request and resolves with the parsed result', async () => {
    const { pending, worker } = await startDesign()

    expect(worker.posted).toHaveLength(1)
    expect(worker.posted[0]).toMatchObject({ type: 'design', CDS: 'ATGTGA' })

    worker.emit({ type: 'result', runId: worker.runId, result: validResult() })
    const outcome = await pending

    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.data.optimized_sequence).toBe('ATGTGA')
      expect(outcome.data.seed).toBe(1234)
    }
  })

  it('reports progress while the design runs', async () => {
    const onProgress = vi.fn()
    const { pending, worker } = await startDesign({ onProgress })

    worker.emit({
      type: 'progress',
      runId: worker.runId,
      fraction: 0.45,
      stage: 'Optimizing sequence',
    })
    expect(onProgress).toHaveBeenCalledWith(0.45, 'Optimizing sequence')

    worker.emit({ type: 'result', runId: worker.runId, result: validResult() })
    await pending
  })

  it('ignores messages from a previous run', async () => {
    const onProgress = vi.fn()
    const { pending, worker } = await startDesign({ onProgress })

    // A stale message, e.g. from a run that was cancelled.
    worker.emit({
      type: 'progress',
      runId: 'some-older-run',
      fraction: 0.9,
      stage: 'Stale',
    })
    expect(onProgress).not.toHaveBeenCalled()

    worker.emit({ type: 'result', runId: worker.runId, result: validResult() })
    expect((await pending).ok).toBe(true)
  })

  it('surfaces an invalid sequence as the optimizer worded it', async () => {
    const { pending, worker } = await startDesign()

    worker.emit({
      type: 'error',
      runId: worker.runId,
      code: 'invalid_input',
      message: 'Coding sequence length is not a multiple of 3',
    })
    const outcome = await pending

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('invalid_input')
      expect(outcome.error.message).toBe(
        'Coding sequence length is not a multiple of 3',
      )
      // The user's own input is at fault, so retrying unchanged will not help.
      expect(outcome.error.retriable).toBe(false)
    }
  })

  it('rejects a result that does not match the backend contract', async () => {
    const { pending, worker } = await startDesign()

    // An empty optimized sequence would render as a successful empty design.
    worker.emit({
      type: 'result',
      runId: worker.runId,
      result: validResult({ optimized_sequence: '' }),
    })
    const outcome = await pending

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe('backend')
  })

  it('terminates the worker when the run is aborted', async () => {
    const controller = new AbortController()
    const { pending, worker } = await startDesign({ signal: controller.signal })

    controller.abort()
    const outcome = await pending

    expect(worker.terminated).toBe(true)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe('cancelled')
  })

  it('returns immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const outcome = await designInBrowser(
      { CDS: 'ATGTGA', name: 'test', options: {} as never },
      { signal: controller.signal },
    )

    expect(outcome.ok).toBe(false)
    // No worker should have been started for a run that was already over.
    expect(FakeWorker.instances).toHaveLength(0)
  })

  it('recovers from a crashed worker by starting a new one', async () => {
    const first = await startDesign()
    first.worker.crash()
    const outcome = await first.pending

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.retriable).toBe(true)
    expect(first.worker.terminated).toBe(true)

    // The next design must not reuse the dead worker.
    const second = await startDesign()
    expect(second.worker).not.toBe(first.worker)
    second.worker.emit({
      type: 'result',
      runId: second.worker.runId,
      result: validResult(),
    })
    expect((await second.pending).ok).toBe(true)
  })

  it('reuses one worker across designs', async () => {
    const first = await startDesign()
    first.worker.emit({
      type: 'result',
      runId: first.worker.runId,
      result: validResult(),
    })
    await first.pending

    const second = await startDesign()
    expect(second.worker).toBe(first.worker)
    expect(FakeWorker.instances).toHaveLength(1)
  })

  it('reports a clear failure when the browser cannot run it', async () => {
    vi.stubGlobal('Worker', undefined)
    const outcome = await designInBrowser({
      CDS: 'ATGTGA',
      name: 'test',
      options: {} as never,
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('backend')
      expect(outcome.error.retriable).toBe(false)
    }
    vi.stubGlobal('Worker', FakeWorker)
  })
})

describe('warmOptimizerWorker', () => {
  it('starts the worker so the download overlaps with typing', () => {
    warmOptimizerWorker()
    expect(FakeWorker.instances).toHaveLength(1)
  })

  it('does nothing in a browser that cannot run it', () => {
    vi.stubGlobal('Worker', undefined)
    expect(() => warmOptimizerWorker()).not.toThrow()
    expect(FakeWorker.instances).toHaveLength(0)
    vi.stubGlobal('Worker', FakeWorker)
  })
})

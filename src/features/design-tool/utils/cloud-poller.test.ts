import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { CloudDesign } from '@/features/design-tool/types/cloud-design'

import { createCloudPoller, nextPollDelay } from './cloud-poller'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)

function design(id: string, status: CloudDesign['status']): CloudDesign {
  return { id, status }
}

describe('nextPollDelay', () => {
  it('doubles from 2 s and caps at a minute', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10].map(nextPollDelay)).toEqual([
      2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000,
    ])
  })
})

describe('createCloudPoller', () => {
  let running: Set<string>
  let statuses: Map<string, CloudDesign['status'] | 404 | 'offline'>
  const fetchDesign = vi.fn(async (id: string) => {
    const status = statuses.get(id) ?? 'running'
    if (status === 404) {
      return { ok: false as const, status: 404, message: 'gone' }
    }
    if (status === 'offline') {
      return { ok: false as const, status: 0, message: 'offline' }
    }
    return { ok: true as const, data: design(id, status) }
  })
  // A settled design leaves history's running list, as it does in the app.
  const onSettled = vi.fn((id: string) => {
    running.delete(id)
  })

  beforeEach(() => {
    vi.useFakeTimers()
    fetchDesign.mockClear()
    onSettled.mockClear()
    running = new Set([A])
    statuses = new Map()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function poller() {
    return createCloudPoller({
      runningIds: () => [...running],
      fetchDesign,
      onSettled,
    })
  }

  /** Lets the in-flight poll's promises run. */
  const flush = () => vi.advanceTimersByTimeAsync(0)

  it('polls at once on start, then backs off', async () => {
    const p = poller()
    p.start()
    await flush()
    expect(fetchDesign).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_999)
    expect(fetchDesign).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchDesign).toHaveBeenCalledTimes(2)

    // Then 4 s, then 8 s.
    await vi.advanceTimersByTimeAsync(4_000)
    expect(fetchDesign).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(7_999)
    expect(fetchDesign).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchDesign).toHaveBeenCalledTimes(4)
    p.stop()
  })

  it('settles a design once it finishes, and stops polling when nothing runs', async () => {
    const p = poller()
    p.start()
    await flush()
    statuses.set(A, 'completed')
    await vi.advanceTimersByTimeAsync(2_000)

    expect(onSettled).toHaveBeenCalledWith(A, {
      found: true,
      design: design(A, 'completed'),
    })
    fetchDesign.mockClear()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(fetchDesign).not.toHaveBeenCalled()
    p.stop()
  })

  it('settles a failed design too', async () => {
    statuses.set(A, 'failed')
    const p = poller()
    p.start()
    await flush()
    expect(onSettled).toHaveBeenCalledWith(A, {
      found: true,
      design: design(A, 'failed'),
    })
    p.stop()
  })

  it('reports a design the cloud no longer has as not found', async () => {
    statuses.set(A, 404)
    const p = poller()
    p.start()
    await flush()
    expect(onSettled).toHaveBeenCalledWith(A, { found: false })
    p.stop()
  })

  it('keeps waiting through an outage rather than giving up on the design', async () => {
    statuses.set(A, 'offline')
    const p = poller()
    p.start()
    await flush()
    await vi.advanceTimersByTimeAsync(2_000 + 4_000)
    expect(fetchDesign).toHaveBeenCalledTimes(3)
    expect(onSettled).not.toHaveBeenCalled()
    p.stop()
  })

  it('polls every running design', async () => {
    running = new Set([A, B])
    const p = poller()
    p.start()
    await flush()
    expect(fetchDesign.mock.calls.map(([id]) => id)).toEqual([A, B])
    p.stop()
  })

  it('wake resets the backoff and polls at once (the tab regained focus)', async () => {
    const p = poller()
    p.start()
    await flush()
    // Let the backoff grow: polls at 2 s and 6 s; the next is 8 s later.
    await vi.advanceTimersByTimeAsync(6_000)
    expect(fetchDesign).toHaveBeenCalledTimes(3)

    p.wake()
    await flush()
    expect(fetchDesign).toHaveBeenCalledTimes(4)
    // Back to a 2 s wait.
    await vi.advanceTimersByTimeAsync(2_000)
    expect(fetchDesign).toHaveBeenCalledTimes(5)
    p.stop()
  })

  it('does not poll at all when nothing is running', async () => {
    running = new Set()
    const p = poller()
    p.start()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchDesign).not.toHaveBeenCalled()
    p.stop()
  })

  it('picks up a design submitted after it went idle, when woken', async () => {
    running = new Set()
    const p = poller()
    p.start()
    await flush()
    running.add(B)
    p.wake()
    await flush()
    expect(fetchDesign).toHaveBeenCalledWith(B)
    p.stop()
  })

  it('stops for good on stop', async () => {
    const p = poller()
    p.start()
    await flush()
    p.stop()
    p.wake()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(fetchDesign).toHaveBeenCalledTimes(1)
  })
})

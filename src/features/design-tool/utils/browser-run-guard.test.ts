import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeLocks } from '@/features/design-tool/test-utils/fake-locks'
import {
  claimAbandonedRun,
  guardUnload,
  holdRunLock,
} from './browser-run-guard'

const unloadPrevented = () => {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe('guardUnload', () => {
  it('warns before unload only while held', () => {
    expect(unloadPrevented()).toBe(false)
    const release = guardUnload()
    expect(unloadPrevented()).toBe(true)
    release()
    expect(unloadPrevented()).toBe(false)
  })

  it('keeps warning until the last overlapping run releases', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const a = guardUnload()
    const b = guardUnload()
    expect(
      add.mock.calls.filter(([t]) => String(t) === 'beforeunload'),
    ).toHaveLength(1)
    a()
    a() // a second release is a no-op, not an underflow
    expect(unloadPrevented()).toBe(true)
    b()
    expect(unloadPrevented()).toBe(false)
    add.mockRestore()
  })
})

describe('run locks', () => {
  let locks: ReturnType<typeof installFakeLocks> | undefined
  afterEach(() => locks?.uninstall())

  it('holds the lock until the run settles', async () => {
    locks = installFakeLocks()
    let finish!: () => void
    const run = new Promise<void>((resolve) => (finish = resolve))
    holdRunLock('browser-1', run)
    await vi.waitFor(() =>
      expect(locks!.held.has('rej-studio:browser-run:browser-1')).toBe(true),
    )

    const settle = vi.fn()
    expect(await claimAbandonedRun('browser-1', settle)).toBe(false)
    expect(settle).not.toHaveBeenCalled()

    finish()
    await vi.waitFor(() => expect(locks!.held.size).toBe(0))
    expect(await claimAbandonedRun('browser-1', settle)).toBe(true)
    expect(settle).toHaveBeenCalledOnce()
  })

  it('releases the lock when the run rejects', async () => {
    locks = installFakeLocks()
    holdRunLock('browser-2', Promise.reject(new Error('boom')))
    await vi.waitFor(() => expect(locks!.held.size).toBe(0))
  })

  it('never claims a run without Web Locks', async () => {
    const settle = vi.fn()
    expect(await claimAbandonedRun('browser-3', settle)).toBe(false)
    expect(settle).not.toHaveBeenCalled()
    // And holding is a silent no-op.
    expect(() => holdRunLock('browser-3', Promise.resolve())).not.toThrow()
  })
})

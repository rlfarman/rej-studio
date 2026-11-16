import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeLocks } from '@/features/design-tool/test-utils/fake-locks'
import {
  useJobHistory,
  whenJobHistoryHydrated,
} from '@/features/design-tool/hooks/use-job-history'
import { holdRunLock } from '@/features/design-tool/utils/browser-run-guard'
import { requestOpenJob } from '@/features/design-tool/utils/finish-notification'
import { render, waitFor } from '@testing-library/react'
import { BrowserRuns, settleInterruptedRuns } from './browser-runs'

const { push, toastWarning } = vi.hoisted(() => ({
  push: vi.fn(),
  toastWarning: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('sonner', () => ({ toast: { warning: toastWarning } }))

let locks: ReturnType<typeof installFakeLocks> | undefined

beforeEach(async () => {
  await whenJobHistoryHydrated()
  useJobHistory.setState({ entries: [], progressById: {} })
})

afterEach(() => {
  locks?.uninstall()
  locks = undefined
})

const upsertRunning = (id: string) =>
  useJobHistory.getState().upsertEntry({ id, status: 'running' })
const status = (id: string) => useJobHistory.getState().getEntry(id)?.status

describe('settleInterruptedRuns', () => {
  it('marks a browser run whose tab is gone as interrupted and retriable', async () => {
    locks = installFakeLocks()
    upsertRunning('browser-orphan')

    expect(await settleInterruptedRuns()).toEqual(['browser-orphan'])
    const entry = useJobHistory.getState().getEntry('browser-orphan')
    expect(entry?.status).toBe('failed')
    expect(entry?.error?.retriable).toBe(true)
    expect(entry?.error?.message).toMatch(/tab closed/i)
  })

  it('leaves a run that another tab is still designing', async () => {
    locks = installFakeLocks()
    upsertRunning('browser-live')
    let finish!: () => void
    holdRunLock('browser-live', new Promise<void>((r) => (finish = r)))
    await vi.waitFor(() => expect(locks!.held.size).toBe(1))

    expect(await settleInterruptedRuns()).toEqual([])
    expect(status('browser-live')).toBe('running')
    finish()
  })

  it('leaves backend jobs to the watcher', async () => {
    locks = installFakeLocks()
    upsertRunning('modal-call-1')
    expect(await settleInterruptedRuns()).toEqual([])
    expect(status('modal-call-1')).toBe('running')
  })

  it('leaves everything alone without Web Locks', async () => {
    upsertRunning('browser-unknown')
    expect(await settleInterruptedRuns()).toEqual([])
    expect(status('browser-unknown')).toBe('running')
  })
})

describe('BrowserRuns', () => {
  it('offers the interrupted run once, opening it on request', async () => {
    locks = installFakeLocks()
    upsertRunning('browser-closed-tab')
    render(<BrowserRuns />)

    await waitFor(() => expect(toastWarning).toHaveBeenCalledOnce())
    expect(status('browser-closed-tab')).toBe('failed')
    const [, options] = toastWarning.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ]
    options.action.onClick()
    expect(push).toHaveBeenCalledWith('/design-tool?job=browser-closed-tab')
  })

  it('opens a job when its notification is clicked', () => {
    render(<BrowserRuns />)
    requestOpenJob('browser-done')
    expect(push).toHaveBeenCalledWith('/design-tool?job=browser-done')
  })
})

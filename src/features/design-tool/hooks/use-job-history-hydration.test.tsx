// The history store loads from IndexedDB asynchronously. These tests import
// a fresh copy of the store per test, against a fresh IndexedDB, so each one
// sees its own first load.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { IDBFactory } from 'fake-indexeddb'
import { createStore, get, set } from 'idb-keyval'
import { JOB_HISTORY_IDB } from '@/features/design-tool/utils/job-history-storage'
import type { JobHistoryEntry } from './use-job-history'

const KEY = 'rej-studio:job-history'

const idbStore = () =>
  createStore(JOB_HISTORY_IDB.database, JOB_HISTORY_IDB.store)
const seedIdb = (...entries: JobHistoryEntry[]) =>
  set(KEY, { state: { entries }, version: 0 }, idbStore())
const savedIds = async () =>
  (
    (await get(KEY, idbStore())) as { state: { entries: JobHistoryEntry[] } }
  )?.state.entries.map((e) => e.id)

const entry = (
  id: string,
  overrides: Partial<JobHistoryEntry> = {},
): JobHistoryEntry => ({
  id,
  name: id,
  sequenceLength: 9,
  createdAt: new Date().toISOString(),
  status: 'completed',
  result: null,
  error: null,
  ...overrides,
})

async function loadStore() {
  vi.resetModules()
  return import('./use-job-history')
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  localStorage.clear()
})

afterEach(() => {
  vi.doUnmock('idb-keyval')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('job history hydration', () => {
  it('starts empty and unhydrated, then loads the saved history', async () => {
    await seedIdb(entry('saved'))
    const { useJobHistory, whenJobHistoryHydrated, useJobHistoryHydrated } =
      await loadStore()

    const { result } = renderHook(() => useJobHistoryHydrated())
    expect(result.current).toBe(false)
    expect(useJobHistory.getState().entries).toEqual([])

    await act(() => whenJobHistoryHydrated())
    expect(result.current).toBe(true)
    expect(useJobHistory.getState().entries.map((e) => e.id)).toEqual(['saved'])
  })

  it('migrates an old localStorage history on first load', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ state: { entries: [entry('legacy')] }, version: 0 }),
    )
    const { useJobHistory, whenJobHistoryHydrated } = await loadStore()
    await whenJobHistoryHydrated()

    expect(useJobHistory.getState().entries.map((e) => e.id)).toEqual([
      'legacy',
    ])
    expect(await savedIds()).toEqual(['legacy'])
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('does not overwrite the saved history with a change made before it loaded', async () => {
    await seedIdb(entry('saved'))
    const put = vi.spyOn(IDBObjectStore.prototype, 'put')
    const { useJobHistory, whenJobHistoryHydrated } = await loadStore()

    // A run submitted in the first instant, before the history is read.
    useJobHistory.getState().upsertEntry({ id: 'early', status: 'running' })
    expect(put).not.toHaveBeenCalled()

    await whenJobHistoryHydrated()
    expect(useJobHistory.getState().entries.map((e) => e.id)).toEqual([
      'early',
      'saved',
    ])
    // The merged history is written once it has loaded.
    await waitFor(async () =>
      expect(await savedIds()).toEqual(['early', 'saved']),
    )
  })

  it('sweeps running entries past the TTL and saves the sweep', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600_000).toISOString()
    await seedIdb(
      entry('orphan', { status: 'running', createdAt: twoDaysAgo }),
      entry('fresh-running', { status: 'running' }),
      entry('old-completed', { createdAt: twoDaysAgo }),
    )
    const { useJobHistory, whenJobHistoryHydrated } = await loadStore()
    await whenJobHistoryHydrated()

    const expected = ['fresh-running', 'old-completed']
    expect(useJobHistory.getState().entries.map((e) => e.id)).toEqual(expected)
    await waitFor(async () => expect(await savedIds()).toEqual(expected))
  })

  it('keeps working in memory without overwriting a history it could not read', async () => {
    await seedIdb(entry('saved'))
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-bound with .call below
    const realGet = IDBObjectStore.prototype.get
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (
      this: IDBObjectStore,
      key: IDBValidKey | IDBKeyRange,
    ) {
      if (key === KEY) throw new DOMException('corrupt', 'DataError')
      return realGet.call(this, key)
    })
    const put = vi.spyOn(IDBObjectStore.prototype, 'put')
    const { useJobHistory, whenJobHistoryHydrated } = await loadStore()
    await whenJobHistoryHydrated()

    useJobHistory.getState().upsertEntry({ id: 'new', status: 'completed' })
    expect(useJobHistory.getState().getEntry('new')).not.toBeNull()
    expect(put).not.toHaveBeenCalled()
  })

  it('runs in memory when no storage is available at all', async () => {
    vi.stubGlobal('indexedDB', undefined)
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const { useJobHistory, whenJobHistoryHydrated } = await loadStore()
    await whenJobHistoryHydrated()

    useJobHistory.getState().upsertEntry({ id: 'mem', status: 'completed' })
    expect(useJobHistory.getState().getEntry('mem')).not.toBeNull()
  })

  it('reloads when another tab writes', async () => {
    const { useJobHistory, whenJobHistoryHydrated } = await loadStore()
    await whenJobHistoryHydrated()

    await seedIdb(entry('from-other-tab'))
    const otherTab = new BroadcastChannel(KEY)
    otherTab.postMessage('written')
    otherTab.close()

    await waitFor(() =>
      expect(useJobHistory.getState().entries.map((e) => e.id)).toEqual([
        'from-other-tab',
      ]),
    )
  })
})

describe('useJob resuming ?job= before the history loads', () => {
  function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient()
    return createElement(QueryClientProvider, { client }, children)
  }

  it('waits for the saved entry instead of calling it unavailable', async () => {
    await seedIdb(entry('done-job', { status: 'completed' }))
    // Hold the history read so the hook renders before it lands.
    let releaseRead!: () => void
    const readHeld = new Promise<void>((resolve) => (releaseRead = resolve))
    vi.doMock('idb-keyval', async (importOriginal) => {
      const actual = await importOriginal<typeof import('idb-keyval')>()
      return {
        ...actual,
        get: async (...args: Parameters<typeof actual.get>) => {
          if (args[0] === KEY) await readHeld
          return actual.get(...args)
        },
      }
    })
    const { useJobHistory } = await loadStore()
    const { useJob } = await import('./use-job')

    const { result } = renderHook(() => useJob({ initialJobId: 'done-job' }), {
      wrapper,
    })
    expect(result.current.isRestoring).toBe(true)
    expect(result.current.status).toBe('idle')
    expect(useJobHistory.getState().entries).toEqual([])

    releaseRead()
    await waitFor(() => expect(result.current.status).toBe('completed'))
    expect(result.current.isRestoring).toBe(false)
    // Never read as missing while the history was still loading.
    expect(useJobHistory.getState().getRunningIds()).toEqual([])
  })

  it('reads an unknown job as unavailable once loaded, writing nothing', async () => {
    const { useJobHistory } = await loadStore()
    const { useJob } = await import('./use-job')

    const { result } = renderHook(
      () => useJob({ initialJobId: 'shared-job' }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.error?.code).toBe('not_found')
    expect(result.current.isRestoring).toBe(false)
    expect(useJobHistory.getState().entries).toEqual([])
  })
})

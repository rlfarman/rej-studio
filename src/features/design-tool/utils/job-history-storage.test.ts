import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createStore, get, set } from 'idb-keyval'
import type { JobHistoryEntry } from '@/features/design-tool/hooks/use-job-history'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import {
  createJobHistoryStorage,
  JOB_HISTORY_IDB,
  type PersistedJobHistory,
} from './job-history-storage'

const KEY = 'rej-studio:job-history'

const entry = (
  id: string,
  createdAt: string,
  overrides: Partial<JobHistoryEntry> = {},
): JobHistoryEntry => ({
  id,
  name: id,
  sequenceLength: 9,
  createdAt,
  status: 'completed',
  result: { name: id } as ProcessResult,
  error: null,
  ...overrides,
})

const payload = (...entries: JobHistoryEntry[]) => ({
  state: { entries } satisfies PersistedJobHistory,
  version: 0,
})

const idbStore = () =>
  createStore(JOB_HISTORY_IDB.database, JOB_HISTORY_IDB.store)
const readIdb = () => get(KEY, idbStore())
const ids = (value: unknown) =>
  (value as ReturnType<typeof payload> | null)?.state.entries.map((e) => e.id)

const storage = (onWrite?: () => void) => {
  const s = createJobHistoryStorage({ maxEntries: 50, onWrite })
  if (!s) throw new Error('expected a storage in the browser')
  return s
}

beforeEach(() => {
  // A fresh, empty IndexedDB per test.
  vi.stubGlobal('indexedDB', new IDBFactory())
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('createJobHistoryStorage', () => {
  it('stores the history in IndexedDB, not localStorage', async () => {
    const onWrite = vi.fn()
    const s = storage(onWrite)
    await s.setItem(KEY, payload(entry('a', '2026-11-01T00:00:00Z')))

    expect(ids(await readIdb())).toEqual(['a'])
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(onWrite).toHaveBeenCalledOnce()
    expect(ids(await storage().getItem(KEY))).toEqual(['a'])
  })

  it('writes only the latest of several quick updates, in order', async () => {
    const s = storage()
    const writes = [
      s.setItem(KEY, payload(entry('a', '2026-11-01T00:00:00Z'))),
      s.setItem(KEY, payload(entry('b', '2026-11-02T00:00:00Z'))),
      s.setItem(KEY, payload(entry('c', '2026-11-03T00:00:00Z'))),
    ]
    await Promise.all(writes)
    expect(ids(await readIdb())).toEqual(['c'])
  })

  it('returns null when nothing is stored anywhere', async () => {
    expect(await storage().getItem(KEY)).toBeNull()
    expect(await readIdb()).toBeUndefined()
  })

  it('treats a stored value of the wrong shape as absent', async () => {
    await set(KEY, { state: { entries: 'nope' } }, idbStore())
    expect(await storage().getItem(KEY)).toBeNull()
  })

  describe('migration from localStorage', () => {
    it('moves an old history into IndexedDB, then removes the old key', async () => {
      localStorage.setItem(
        KEY,
        JSON.stringify(payload(entry('old', '2026-10-01T00:00:00Z'))),
      )

      expect(ids(await storage().getItem(KEY))).toEqual(['old'])
      expect(ids(await readIdb())).toEqual(['old'])
      expect(localStorage.getItem(KEY)).toBeNull()
    })

    it('merges both copies when both exist, IndexedDB winning', async () => {
      await set(
        KEY,
        payload(
          entry('shared', '2026-11-02T00:00:00Z', { name: 'from idb' }),
          entry('idb-only', '2026-11-01T00:00:00Z'),
        ),
        idbStore(),
      )
      localStorage.setItem(
        KEY,
        JSON.stringify(
          payload(
            entry('ls-only', '2026-11-03T00:00:00Z'),
            entry('shared', '2026-11-02T00:00:00Z', { name: 'from ls' }),
          ),
        ),
      )

      const value = await storage().getItem(KEY)
      expect(ids(value)).toEqual(['ls-only', 'shared', 'idb-only'])
      expect(value?.state.entries[1].name).toBe('from idb')
      expect(ids(await readIdb())).toEqual(['ls-only', 'shared', 'idb-only'])
      expect(localStorage.getItem(KEY)).toBeNull()
    })

    it('leaves a corrupt old key alone and reports nothing stored', async () => {
      localStorage.setItem(KEY, '{not json')
      expect(await storage().getItem(KEY)).toBeNull()
      expect(localStorage.getItem(KEY)).toBe('{not json')

      localStorage.setItem(KEY, JSON.stringify({ state: { entries: 3 } }))
      expect(await storage().getItem(KEY)).toBeNull()
      expect(await readIdb()).toBeUndefined()
    })

    it('keeps the old key when the IndexedDB write fails', async () => {
      localStorage.setItem(
        KEY,
        JSON.stringify(payload(entry('old', '2026-10-01T00:00:00Z'))),
      )
      vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
        throw new DOMException('disk on fire', 'UnknownError')
      })

      // The history is still served, from memory, for this session...
      expect(ids(await storage().getItem(KEY))).toEqual(['old'])
      // ...and the original survives for the next load to retry.
      expect(localStorage.getItem(KEY)).not.toBeNull()
    })

    it('falls back to the localStorage copy when IndexedDB is unavailable', async () => {
      vi.stubGlobal('indexedDB', undefined)
      localStorage.setItem(
        KEY,
        JSON.stringify(payload(entry('old', '2026-10-01T00:00:00Z'))),
      )

      const s = storage()
      expect(ids(await s.getItem(KEY))).toEqual(['old'])
      // Same key, same format, so a later session with IndexedDB migrates it.
      await s.setItem(
        KEY,
        payload(
          entry('new', '2026-11-01T00:00:00Z'),
          entry('old', '2026-10-01T00:00:00Z'),
        ),
      )
      expect(ids(JSON.parse(localStorage.getItem(KEY)!))).toEqual([
        'new',
        'old',
      ])
    })
  })

  it('keeps working with no storage at all', async () => {
    // Site data blocked: even touching localStorage throws.
    vi.stubGlobal('indexedDB', undefined)
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const onWrite = vi.fn()
    const s = storage(onWrite)

    expect(await s.getItem(KEY)).toBeNull()
    await expect(
      s.setItem(KEY, payload(entry('a', '2026-11-01T00:00:00Z'))),
    ).resolves.toBeUndefined()
    expect(onWrite).not.toHaveBeenCalled()
  })

  it('retries a quota error with a slimmed payload instead of losing the write', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-bound with .call below
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: ReturnType<typeof payload>,
      key?: IDBValidKey,
    ) {
      // Too big while every entry still carries its result.
      if (value.state.entries.every((e) => e.result !== null)) {
        throw new DOMException('full', 'QuotaExceededError')
      }
      return put.call(this, value, key)
    })

    await storage().setItem(
      KEY,
      payload(
        entry('new', '2026-11-04T00:00:00Z'),
        entry('mid', '2026-11-03T00:00:00Z'),
        entry('older', '2026-11-02T00:00:00Z'),
        entry('oldest', '2026-11-01T00:00:00Z'),
      ),
    )

    const stored = (await readIdb()) as ReturnType<typeof payload>
    expect(ids(stored)).toEqual(['new', 'mid', 'older', 'oldest'])
    // Results dropped from the oldest half only.
    expect(stored.state.entries.map((e) => e.result !== null)).toEqual([
      true,
      true,
      false,
      false,
    ])
  })
})

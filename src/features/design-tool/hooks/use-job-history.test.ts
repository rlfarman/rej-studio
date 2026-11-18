import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createStore, get } from 'idb-keyval'
import { JOB_HISTORY_IDB } from '@/features/design-tool/utils/job-history-storage'
import {
  isSeedId,
  useJobHistory,
  whenJobHistoryHydrated,
} from './use-job-history'

const readPersisted = () =>
  get(
    'rej-studio:job-history',
    createStore(JOB_HISTORY_IDB.database, JOB_HISTORY_IDB.store),
  )

describe('isSeedId', () => {
  it('returns true for seed- prefix', () => {
    expect(isSeedId('seed-abc')).toBe(true)
  })
  it('returns false for non-seed', () => {
    expect(isSeedId('real-abc')).toBe(false)
  })
})

describe('useJobHistory', () => {
  beforeEach(async () => {
    await whenJobHistoryHydrated()
    localStorage.clear()
    useJobHistory.setState({ entries: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('starts empty', () => {
    expect(useJobHistory.getState().entries).toEqual([])
  })

  it('upserts new entry with createdAt', () => {
    useJobHistory.getState().upsertEntry({
      id: 'job-1',
      status: 'running',
    })
    const entry = useJobHistory.getState().getEntry('job-1')
    expect(entry).not.toBeNull()
    expect(entry!.status).toBe('running')
    expect(entry!.createdAt).toBeTruthy()
    expect(entry!.name).toBe('Untitled')
  })

  it('preserves createdAt on update', () => {
    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'running' })
    const createdAt = useJobHistory.getState().getEntry('job-1')!.createdAt

    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'completed' })
    expect(useJobHistory.getState().getEntry('job-1')!.createdAt).toBe(
      createdAt,
    )
  })

  it('keeps progress out of the persisted entries', async () => {
    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'running' })
    useJobHistory
      .getState()
      .setProgress('job-1', { progress: 0.5, stage: 'optimizing' })

    expect(useJobHistory.getState().getProgress('job-1')).toEqual({
      progress: 0.5,
      stage: 'optimizing',
    })
    // The entry itself is persisted; a progress tick must not be.
    await vi.waitFor(async () => {
      expect(JSON.stringify(await readPersisted())).toContain('job-1')
    })
    expect(JSON.stringify(await readPersisted())).not.toContain('optimizing')
  })

  it('persists entries to IndexedDB, not localStorage', async () => {
    useJobHistory.getState().upsertEntry({ id: 'job-idb', status: 'running' })
    await vi.waitFor(async () => {
      expect(JSON.stringify(await readPersisted())).toContain('job-idb')
    })
    expect(localStorage.getItem('rej-studio:job-history')).toBeNull()
  })

  it('drops progress once the job reaches a terminal status', () => {
    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'running' })
    useJobHistory
      .getState()
      .setProgress('job-1', { progress: 0.5, stage: 'optimizing' })

    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'completed' })
    expect(useJobHistory.getState().getProgress('job-1')).toBeUndefined()
  })

  it.each(['QuotaExceededError', 'UnknownError', 'InvalidStateError'])(
    'survives a storage write that throws %s',
    async (name) => {
      const put = vi
        .spyOn(IDBObjectStore.prototype, 'put')
        .mockImplementation(() => {
          throw new DOMException('nope', name)
        })
      expect(() =>
        useJobHistory
          .getState()
          .upsertEntry({ id: 'job-q', status: 'running' }),
      ).not.toThrow()
      // Every slimmed retry (or the one attempt) has been made and failed.
      await vi.waitFor(() => expect(put).toHaveBeenCalled())
      expect(useJobHistory.getState().getEntry('job-q')).not.toBeNull()
    },
  )

  it('derives name from formValues', () => {
    useJobHistory.getState().upsertEntry({
      id: 'job-1',
      status: 'running',
      formValues: { name: 'My Gene', codingSequence: 'ATGAAATGA' } as any,
    })
    expect(useJobHistory.getState().getEntry('job-1')!.name).toBe('My Gene')
    expect(useJobHistory.getState().getEntry('job-1')!.sequenceLength).toBe(9)
  })

  it('caps at 50 entries', () => {
    for (let i = 0; i < 55; i++) {
      useJobHistory
        .getState()
        .upsertEntry({ id: `job-${i}`, status: 'running' })
    }
    expect(useJobHistory.getState().entries).toHaveLength(50)
  })

  it('removes entry', () => {
    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'running' })
    useJobHistory.getState().removeEntry('job-1')
    expect(useJobHistory.getState().getEntry('job-1')).toBeNull()
  })

  it('clears history', () => {
    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'running' })
    useJobHistory.getState().upsertEntry({ id: 'job-2', status: 'completed' })
    useJobHistory.getState().clearHistory()
    expect(useJobHistory.getState().entries).toHaveLength(0)
  })

  it('getEntry returns null for non-existent', () => {
    expect(useJobHistory.getState().getEntry('nope')).toBeNull()
  })
})

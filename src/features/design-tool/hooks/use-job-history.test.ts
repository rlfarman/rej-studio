import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSeedId, useJobHistory } from './use-job-history'

describe('isSeedId', () => {
  it('returns true for seed- prefix', () => {
    expect(isSeedId('seed-abc')).toBe(true)
  })
  it('returns false for non-seed', () => {
    expect(isSeedId('real-abc')).toBe(false)
  })
})

describe('useJobHistory', () => {
  beforeEach(() => {
    localStorage.clear()
    useJobHistory.setState({ entries: [] })
  })

  afterEach(() => {
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

  it('keeps progress out of the persisted entries', () => {
    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'running' })
    useJobHistory
      .getState()
      .setProgress('job-1', { progress: 0.5, stage: 'optimizing' })

    expect(useJobHistory.getState().getProgress('job-1')).toEqual({
      progress: 0.5,
      stage: 'optimizing',
    })
    // A progress tick must not rewrite the persisted history.
    const persisted = JSON.parse(
      localStorage.getItem('rej-studio:job-history') ?? '{}',
    )
    expect(JSON.stringify(persisted)).not.toContain('optimizing')
  })

  it('drops progress once the job reaches a terminal status', () => {
    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'running' })
    useJobHistory
      .getState()
      .setProgress('job-1', { progress: 0.5, stage: 'optimizing' })

    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'completed' })
    expect(useJobHistory.getState().getProgress('job-1')).toBeUndefined()
  })

  it('lists running ids for best-effort cancellation', () => {
    useJobHistory.getState().upsertEntry({ id: 'job-1', status: 'running' })
    useJobHistory.getState().upsertEntry({ id: 'job-2', status: 'completed' })
    expect(useJobHistory.getState().getRunningIds()).toEqual(['job-1'])
  })

  it('survives a storage write that throws', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('nope', 'QuotaExceededError')
      })
    try {
      expect(() =>
        useJobHistory
          .getState()
          .upsertEntry({ id: 'job-q', status: 'running' }),
      ).not.toThrow()
      expect(useJobHistory.getState().getEntry('job-q')).not.toBeNull()
    } finally {
      setItem.mockRestore()
    }
  })

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

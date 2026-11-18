import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { clearDraft, useFormDraft } from './use-form-draft'

const DRAFT_KEY = 'rej-studio:design-draft:new'

const DEFAULTS: Partial<FormValues> = {
  sequenceType: 'dna',
  codingSequence: '',
  proteinSequence: '',
  name: '',
  species: 'none',
  spliceJunctionPositions: [1],
}

function renderDraft({
  draftKey = 'new',
  enabled = true,
}: { draftKey?: string; enabled?: boolean } = {}) {
  return renderHook(() => {
    const methods = useForm<FormValues>({
      defaultValues: DEFAULTS as FormValues,
    })
    const draft = useFormDraft({ draftKey, methods, enabled })
    return { methods, draft }
  })
}

function storeDraft(values: Partial<FormValues>) {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      v: 1,
      savedAt: new Date().toISOString(),
      values: { ...DEFAULTS, ...values },
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

afterEach(() => cleanup())

describe('useFormDraft', () => {
  it('saves pasted inputs after the debounce window', async () => {
    const { result } = renderDraft()

    act(() => {
      result.current.methods.setValue('codingSequence', 'ATGAAATGA')
      result.current.methods.setValue('name', 'My gene')
    })

    await waitFor(
      () => {
        const raw = localStorage.getItem(DRAFT_KEY)
        expect(raw).toBeTruthy()
        expect(JSON.parse(raw!).values.codingSequence).toBe('ATGAAATGA')
      },
      { timeout: 3000 },
    )
  })

  it('restores a stored draft and flags it', async () => {
    storeDraft({ codingSequence: 'ATGTTTTGA', name: 'Restored gene' })

    const { result } = renderDraft()

    await waitFor(() => {
      expect(result.current.draft.restored).toBe(true)
      expect(result.current.methods.getValues('codingSequence')).toBe(
        'ATGTTTTGA',
      )
      expect(result.current.methods.getValues('name')).toBe('Restored gene')
    })
  })

  it('ignores an empty draft', async () => {
    storeDraft({ codingSequence: '', name: '' })
    const { result } = renderDraft()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current.draft.restored).toBe(false)
  })

  it('ignores a draft written by an older version', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ v: 0, values: { codingSequence: 'ATGAAATGA' } }),
    )
    const { result } = renderDraft()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current.draft.restored).toBe(false)
    expect(result.current.methods.getValues('codingSequence')).toBe('')
  })

  it('stays out of the way while a saved job is being resumed', async () => {
    storeDraft({ codingSequence: 'ATGAAATGA', name: 'Draft' })
    const { result } = renderDraft({ enabled: false })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current.draft.restored).toBe(false)
    expect(result.current.methods.getValues('codingSequence')).toBe('')
  })

  it('discard drops the stored draft and resets the form', async () => {
    storeDraft({ codingSequence: 'ATGTTTTGA', name: 'Restored gene' })
    const { result } = renderDraft()
    await waitFor(() => expect(result.current.draft.restored).toBe(true))

    act(() => result.current.draft.discard())

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
    expect(result.current.draft.restored).toBe(false)
    expect(result.current.methods.getValues('codingSequence')).toBe('')
  })

  it('dismiss keeps the values and only hides the notice', async () => {
    storeDraft({ codingSequence: 'ATGTTTTGA' })
    const { result } = renderDraft()
    await waitFor(() => expect(result.current.draft.restored).toBe(true))

    act(() => result.current.draft.dismiss())

    expect(result.current.draft.restored).toBe(false)
    expect(result.current.methods.getValues('codingSequence')).toBe('ATGTTTTGA')
  })

  it('clears on a successful submit', async () => {
    storeDraft({ codingSequence: 'ATGTTTTGA' })
    const { result } = renderDraft()
    await waitFor(() => expect(result.current.draft.restored).toBe(true))

    act(() => result.current.draft.clear())
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('scopes drafts per isoform', async () => {
    storeDraft({ codingSequence: 'ATGTTTTGA' })
    const { result } = renderDraft({ draftKey: 'iso-ENST1' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current.draft.restored).toBe(false)
  })

  it('survives a storage write that throws', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('nope', 'QuotaExceededError')
      })
    try {
      const { result } = renderDraft()
      act(() => {
        result.current.methods.setValue('codingSequence', 'ATGAAATGA')
      })
      await new Promise((resolve) => setTimeout(resolve, 900))
      expect(result.current.methods.getValues('codingSequence')).toBe(
        'ATGAAATGA',
      )
    } finally {
      setItem.mockRestore()
    }
  })

  it('clearDraft tolerates unavailable storage', () => {
    const removeItem = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    try {
      expect(() => clearDraft('new')).not.toThrow()
    } finally {
      removeItem.mockRestore()
    }
  })
})

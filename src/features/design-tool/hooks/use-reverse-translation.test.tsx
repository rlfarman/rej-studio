import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form'
import type { PropsWithChildren } from 'react'

import type { FormValues } from '@/features/design-tool/types/form-schema'
import { useReverseTranslation } from './use-reverse-translation'

const reverseTranslateInBrowser = vi.hoisted(() => vi.fn())
vi.mock('@/features/design-tool/api/browser-optimizer', () => ({
  reverseTranslateInBrowser,
}))

const DEFAULTS: Partial<FormValues> = {
  sequenceType: 'protein',
  codingSequence: '',
  proteinSequence: '',
  name: '',
  species: 'human',
  selectedWggwSites: [null],
  spliceJunctionPositions: [1],
}

/**
 * Render the hook inside a form, exposing both the form and the hook's state.
 *
 * The form has to be the hook's provider, so it is created in the wrapper and
 * handed back out through a closure.
 */
function render(overrides: Partial<FormValues> = {}) {
  let methods: UseFormReturn<FormValues> | null = null
  function Wrapper({ children }: PropsWithChildren) {
    const form = useForm<FormValues>({
      defaultValues: { ...DEFAULTS, ...overrides } as FormValues,
    })
    methods = form
    return <FormProvider {...form}>{children}</FormProvider>
  }
  const hook = renderHook(() => useReverseTranslation(), { wrapper: Wrapper })
  return {
    state: () => hook.result.current,
    form: () => methods as unknown as UseFormReturn<FormValues>,
  }
}

afterEach(() => {
  cleanup()
  reverseTranslateInBrowser.mockReset()
})

describe('useReverseTranslation', () => {
  it('fills the coding sequence from the optimizer', async () => {
    reverseTranslateInBrowser.mockResolvedValue({
      ok: true,
      CDS: 'ATGAAGAGATGA',
    })
    const view = render()

    act(() => {
      view.form().setValue('proteinSequence', 'MKR*')
    })

    await waitFor(() => {
      expect(view.form().getValues('codingSequence')).toBe('ATGAAGAGATGA')
    })
    await waitFor(() => {
      expect(view.state()).toEqual({ pending: false, error: null })
    })
    // The split points come from the DNA, not the protein.
    expect(view.form().getValues('spliceJunctionPositions')).toEqual([6])
    expect(reverseTranslateInBrowser).toHaveBeenCalledWith(
      'MKR*',
      'human',
      expect.anything(),
    )
  })

  it('reports pending and shows no stale DNA while the protein changes', async () => {
    reverseTranslateInBrowser.mockResolvedValue({
      ok: true,
      CDS: 'ATGAAGTGA',
    })
    const view = render()

    act(() => {
      view.form().setValue('proteinSequence', 'MK*')
    })
    await waitFor(() => {
      expect(view.form().getValues('codingSequence')).toBe('ATGAAGTGA')
    })

    reverseTranslateInBrowser.mockResolvedValue({
      ok: true,
      CDS: 'ATGAAGAAGTGA',
    })
    act(() => {
      view.form().setValue('proteinSequence', 'MKK*')
    })
    // The previous protein's DNA is gone before the new one arrives.
    expect(view.state().pending).toBe(true)
    expect(view.form().getValues('codingSequence')).toBe('')

    await waitFor(() => {
      expect(view.form().getValues('codingSequence')).toBe('ATGAAGAAGTGA')
    })
  })

  it('asks once for a protein typed a character at a time', async () => {
    reverseTranslateInBrowser.mockResolvedValue({ ok: true, CDS: 'ATGAAGTGA' })
    const view = render()

    act(() => {
      for (const protein of ['M', 'MK', 'MK*']) {
        view.form().setValue('proteinSequence', protein)
      }
    })

    await waitFor(() => {
      expect(reverseTranslateInBrowser).toHaveBeenCalledTimes(1)
    })
    expect(reverseTranslateInBrowser).toHaveBeenCalledWith(
      'MK*',
      'human',
      expect.anything(),
    )
  })

  it('translates again when the species changes', async () => {
    reverseTranslateInBrowser.mockResolvedValue({ ok: true, CDS: 'ATGAGATGA' })
    const view = render({ proteinSequence: 'MR*' })

    await waitFor(() => {
      expect(reverseTranslateInBrowser).toHaveBeenCalledWith(
        'MR*',
        'human',
        expect.anything(),
      )
    })

    act(() => {
      view.form().setValue('species', 'mouse')
    })
    await waitFor(() => {
      expect(reverseTranslateInBrowser).toHaveBeenCalledWith(
        'MR*',
        'mouse',
        expect.anything(),
      )
    })
  })

  it('surfaces a failure instead of leaving a half-filled form', async () => {
    reverseTranslateInBrowser.mockResolvedValue({
      ok: false,
      message: 'Invalid amino acid character(s): Z',
    })
    const view = render()

    act(() => {
      view.form().setValue('proteinSequence', 'MZ*')
    })

    await waitFor(() => {
      expect(view.state().error).toBe('Invalid amino acid character(s): Z')
    })
    expect(view.state().pending).toBe(false)
    expect(view.form().getValues('codingSequence')).toBe('')
  })

  it('does nothing without a species, or in DNA mode', async () => {
    const view = render({ species: 'none', proteinSequence: 'MK*' })
    await waitFor(() => {
      expect(view.state().pending).toBe(false)
    })
    expect(reverseTranslateInBrowser).not.toHaveBeenCalled()

    const dna = render({
      sequenceType: 'dna',
      codingSequence: 'ATGAAGTGA',
      proteinSequence: 'MK*',
    })
    await waitFor(() => {
      expect(dna.state().pending).toBe(false)
    })
    expect(reverseTranslateInBrowser).not.toHaveBeenCalled()
    // A DNA sequence the user typed is left exactly as it is.
    expect(dna.form().getValues('codingSequence')).toBe('ATGAAGTGA')
  })
})

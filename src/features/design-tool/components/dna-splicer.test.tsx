import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { FormValues } from '../types/form-schema'
import { CodingSequenceInput } from './coding-sequence-input'
import { DNASplicer } from './dna-splicer'

// The field's protein mode asks the optimizer worker; DNA mode never does.
vi.mock('@/features/design-tool/api/browser-optimizer', () => ({
  reverseTranslateInBrowser: vi.fn(),
}))

/**
 * How the split points follow the sequence. Typing goes through the real
 * sequence field, one change event per keystroke; a paste sets a sequence
 * and its split points together.
 */

const CODONS = 'ATGAAACCCGGGTTTACGTGCA'

function mount(defaults: Partial<FormValues> = {}) {
  let form!: UseFormReturn<FormValues>
  function Harness() {
    form = useForm<FormValues>({
      defaultValues: {
        sequenceType: 'dna',
        codingSequence: '',
        proteinSequence: '',
        species: 'none',
        // The empty form's placeholder (gene-splitter-form.tsx).
        spliceJunctionPositions: [1],
        selectedWggwSites: [null],
        ...defaults,
      } as FormValues,
    })
    return (
      <FormProvider {...form}>
        <CodingSequenceInput />
        <DNASplicer />
      </FormProvider>
    )
  }
  render(<Harness />)
  return () => form
}

function field() {
  return screen.getByRole('textbox', { name: /enter your sequence/i })
}

function typeInto(form: () => UseFormReturn<FormValues>, text: string) {
  const start = form().getValues('codingSequence')
  for (let i = 1; i <= text.length; i++) {
    fireEvent.change(field(), { target: { value: start + text.slice(0, i) } })
  }
}

function clear() {
  fireEvent.change(field(), { target: { value: '' } })
}

const split = (form: () => UseFormReturn<FormValues>) =>
  form().getValues('spliceJunctionPositions')

afterEach(cleanup)

describe('DNASplicer split points', () => {
  it('keep a typed sequence split in the middle, not walked to the end', () => {
    const form = mount()
    typeInto(form, CODONS.repeat(5))
    // 110 bases: the split stays at the midpoint (it used to end at 109).
    expect(form().getValues('codingSequence')).toBe(CODONS.repeat(5))
    expect(split(form)).toEqual([55])
  })

  it('keep their relative place as bases are added', () => {
    const form = mount({
      codingSequence: CODONS.repeat(5),
      spliceJunctionPositions: [22],
    })
    typeInto(form, CODONS.repeat(5))
    expect(split(form)).toEqual([44])
  })

  it('keep the split points a paste set with its sequence', () => {
    const form = mount({
      codingSequence: CODONS.repeat(5),
      spliceJunctionPositions: [55],
    })
    act(() => {
      form().setValue('codingSequence', CODONS.repeat(10))
      form().setValue('spliceJunctionPositions', [37])
    })
    expect(split(form)).toEqual([37])
  })

  it('start again from the middle after the field is cleared', () => {
    const form = mount({
      codingSequence: CODONS.repeat(5),
      spliceJunctionPositions: [20],
    })
    clear()
    typeInto(form, CODONS.repeat(2))
    expect(split(form)).toEqual([22])
  })
})

import { act, render } from '@testing-library/react'
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form'
import { describe, expect, it } from 'vite-plus/test'

import type { FormValues } from '../types/form-schema'
import { DNASplicer } from './dna-splicer'

/**
 * How the split points follow the sequence. The form is driven the way the
 * sequence field drives it: one setValue per keystroke, or a sequence and
 * its split points together for a paste.
 */

const CODONS = 'ATGAAACCCGGGTTTACGTGCA'

function mount(defaults: Partial<FormValues> = {}) {
  let form!: UseFormReturn<FormValues>
  function Harness() {
    form = useForm<FormValues>({
      defaultValues: {
        codingSequence: '',
        species: 'none',
        // The empty form's placeholder (gene-splitter-form.tsx).
        spliceJunctionPositions: [1],
        selectedWggwSites: [null],
        ...defaults,
      } as FormValues,
    })
    return (
      <FormProvider {...form}>
        <DNASplicer />
      </FormProvider>
    )
  }
  render(<Harness />)
  return () => form
}

function typeInto(form: () => UseFormReturn<FormValues>, text: string) {
  const start = form().getValues('codingSequence')
  for (let i = 1; i <= text.length; i++) {
    act(() => form().setValue('codingSequence', start + text.slice(0, i)))
  }
}

const split = (form: () => UseFormReturn<FormValues>) =>
  form().getValues('spliceJunctionPositions')

describe('DNASplicer split points', () => {
  it('keep a typed sequence split in the middle, not walked to the end', () => {
    const form = mount()
    typeInto(form, CODONS.repeat(5))
    // 110 bases: the split stays at the midpoint (it used to end at 109).
    expect(split(form)).toEqual([55])
  })

  it('keep their relative place as bases are added', () => {
    const sequence = CODONS.repeat(5)
    const form = mount({
      codingSequence: sequence,
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
    act(() => form().setValue('codingSequence', ''))
    typeInto(form, CODONS.repeat(2))
    expect(split(form)).toEqual([22])
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import type { FormValues } from '../types/form-schema'
import { SequenceDiagnostics } from './sequence-diagnostics'

/**
 * `AUGAAAUAA` passes the form's validation — U is an accepted nucleotide — so
 * the badges beside the field must not contradict it.
 */
function mount(codingSequence: string) {
  function Harness() {
    const form = useForm<FormValues>({
      defaultValues: { codingSequence } as FormValues,
    })
    return (
      <FormProvider {...form}>
        <SequenceDiagnostics />
      </FormProvider>
    )
  }
  render(<Harness />)
}

afterEach(cleanup)

describe('SequenceDiagnostics on mRNA', () => {
  it('finds the start and stop codons of an RNA coding sequence', () => {
    mount('AUGAAAUAA')
    expect(screen.queryByText('No start codon')).toBe(null)
    expect(screen.queryByText('No stop codon')).toBe(null)
    expect(screen.getByText('Start codon detected')).toBeTruthy()
    expect(screen.getByText('Stop codon detected')).toBeTruthy()
  })

  it('still reports a missing start codon', () => {
    mount('GGGAAAUAA')
    expect(screen.getByText('No start codon')).toBeTruthy()
  })
})

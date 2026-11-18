import { cleanup, render, screen } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import type { FormValues } from '../types/form-schema'
import { SubmitButton } from './submit-button'

/**
 * The running card is the one live region for a design's progress. This button
 * shows the same stage text, so announcing it here too reads every stage
 * twice.
 */
function mount(props: Parameters<typeof SubmitButton>[0]) {
  function Harness() {
    const form = useForm<FormValues>({ defaultValues: {} as FormValues })
    return (
      <FormProvider {...form}>
        <SubmitButton {...props} />
      </FormProvider>
    )
  }
  render(<Harness />)
  return screen.getByRole('button')
}

afterEach(cleanup)

describe('SubmitButton', () => {
  it('does not announce the stage itself', () => {
    const button = mount({ isJobRunning: true, stage: 'Optimizing codons' })
    expect(button.textContent).toContain('Optimizing codons')
    expect(button.getAttribute('aria-live')).toBe(null)
  })

  it('still says it is busy', () => {
    const button = mount({ isJobRunning: true, stage: 'Optimizing codons' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(true)
  })
})

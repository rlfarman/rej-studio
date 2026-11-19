import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import { designToolCopy } from '../copy'
import type { FormValues } from '../types/form-schema'
import { NameInput } from './name-input'

/**
 * The name is required and starts empty, so a form submitted without one is
 * the default failure path. The field must say so rather than fail silently.
 */

function mount(name = '') {
  let form!: UseFormReturn<FormValues>
  function Harness() {
    form = useForm<FormValues>({ defaultValues: { name } })
    return (
      <FormProvider {...form}>
        <NameInput />
      </FormProvider>
    )
  }
  render(<Harness />)
  return () => form
}

afterEach(cleanup)

describe('NameInput', () => {
  it('shows why an empty name was refused', async () => {
    const form = mount()
    form().setError('name', {
      type: 'manual',
      message: designToolCopy.validation.name.required,
    })
    expect(
      await screen.findByText(designToolCopy.validation.name.required),
    ).toBeTruthy()
  })

  it('points the field at a message that exists', async () => {
    const form = mount()
    const field = screen.getByLabelText(/name/i)
    form().setError('name', {
      type: 'manual',
      message: designToolCopy.validation.name.required,
    })

    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    // The message this field points at must exist, or a screen reader is told
    // the field is invalid and finds nothing explaining why. (FormControl also
    // names a description id even when no FormDescription is rendered — a
    // quirk of the shared primitive, not of this field.)
    const messageId = (field.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .find((id) => id.endsWith('-form-item-message'))
    expect(messageId, 'the field names no message').toBeTruthy()
    expect(document.getElementById(messageId!)).toBeTruthy()
  })

  it('shows the length counter only as the limit nears', () => {
    mount('a'.repeat(199))
    expect(screen.queryByText(/\/ 250/)).toBeNull()
    cleanup()
    mount('a'.repeat(200))
    expect(screen.getByText('200 / 250')).toBeTruthy()
  })
})

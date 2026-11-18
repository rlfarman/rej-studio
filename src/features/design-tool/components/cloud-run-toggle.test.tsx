import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { renderWithAccount } from '@/components/account/test-utils'
import { useSignInDialog } from '@/stores/sign-in-dialog-store'
import { designToolCopy } from '../copy'
import { CloudRunToggle } from './cloud-run-toggle'

const copy = designToolCopy.cloud

beforeEach(() => {
  useSignInDialog.setState({ open: false })
})

function toggle() {
  return screen.getByRole('checkbox', { name: copy.toggleLabel })
}

describe('CloudRunToggle', () => {
  it('can be ticked when signed in, with the privacy line beside it', () => {
    const onCheckedChange = vi.fn()
    renderWithAccount(
      <CloudRunToggle checked={false} onCheckedChange={onCheckedChange} />,
      'signed-in',
    )
    expect(screen.getByText(copy.toggleHint)).toBeTruthy()
    expect(toggle().getAttribute('aria-disabled')).not.toBe('true')
    fireEvent.click(toggle())
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('cannot be ticked signed out, and offers to sign in', () => {
    const onCheckedChange = vi.fn()
    renderWithAccount(
      <CloudRunToggle checked onCheckedChange={onCheckedChange} />,
      'signed-out',
    )
    expect(toggle().getAttribute('aria-checked')).toBe('false')
    expect(toggle().hasAttribute('data-disabled')).toBe(true)
    expect(screen.getByText(copy.signInHint, { exact: false })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: copy.signInAction }))
    expect(useSignInDialog.getState().open).toBe(true)
  })

  it('says so where cloud runs are not available', () => {
    renderWithAccount(
      <CloudRunToggle checked={false} onCheckedChange={vi.fn()} />,
      'unavailable',
    )
    expect(screen.getByText(copy.unavailableHint)).toBeTruthy()
    expect(toggle().hasAttribute('data-disabled')).toBe(true)
  })
})

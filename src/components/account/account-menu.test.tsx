import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const signOut = vi.fn()
vi.mock('@/lib/account/actions', () => ({
  loadAuthClient: async () => ({ signOut }),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { accountCopy } from '@/copy/account'
import { toast } from '@/lib/toast'
import { useSignInDialog } from '@/stores/sign-in-dialog-store'
import { AccountMenu } from './account-menu'
import { ADA, renderWithAccount, serveAccount } from './test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.clearAllMocks()
  useSignInDialog.setState({ open: false })
})

describe('AccountMenu', () => {
  it('draws nothing while the account is unknown', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
    const { container } = renderWithAccount(<AccountMenu />, 'loading')
    expect(container.querySelector('[data-sidebar="menu"]')).toBeNull()
  })

  it('draws nothing where accounts are not available', () => {
    renderWithAccount(<AccountMenu />, 'unavailable')
    expect(
      screen.queryByRole('button', { name: accountCopy.signIn }),
    ).toBeNull()
  })

  it('offers to sign in when signed out, and opens the dialog', () => {
    renderWithAccount(<AccountMenu />, 'signed-out')
    fireEvent.click(screen.getByRole('button', { name: accountCopy.signIn }))
    expect(useSignInDialog.getState().open).toBe(true)
  })

  it('shows the signed-in email, and signs out', async () => {
    signOut.mockResolvedValue({ ok: true })
    serveAccount('signed-out')
    const { client } = renderWithAccount(<AccountMenu />, 'signed-in')
    client.setQueryData(['account', 'cloud-designs'], [])
    const trigger = screen.getByRole('button', {
      name: accountCopy.accountMenuAria(ADA.email),
    })
    fireEvent.click(trigger)
    fireEvent.click(
      await screen.findByRole('menuitem', { name: accountCopy.signOut }),
    )
    await waitFor(() => expect(signOut).toHaveBeenCalled())
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(accountCopy.signedOut),
    )
    // Whatever was read as the account goes with it.
    expect(client.getQueryData(['account', 'cloud-designs'])).toBeUndefined()
    expect(
      await screen.findByRole('button', { name: accountCopy.signIn }),
    ).toBeTruthy()
  })

  it('says so when signing out fails', async () => {
    signOut.mockResolvedValue({ ok: false, message: 'nope' })
    renderWithAccount(<AccountMenu />, 'signed-in')
    fireEvent.click(
      screen.getByRole('button', {
        name: accountCopy.accountMenuAria(ADA.email),
      }),
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: accountCopy.signOut }),
    )
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(accountCopy.signOutFailed),
    )
  })
})

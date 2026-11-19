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
  // Drawing nothing here shoved the rest of the sidebar footer up the
  // moment the read landed, so the row's height is held instead.
  it('holds the row while the account is unknown, saying nothing', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
    const { container } = renderWithAccount(<AccountMenu />, 'loading')
    expect(container.querySelector('[data-sidebar="menu"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  // Nothing is going to fill that row on a deployment without accounts.
  it('draws no row at all where accounts are not available', () => {
    const { container } = renderWithAccount(<AccountMenu />, 'unavailable')
    expect(container.querySelector('[data-sidebar="menu"]')).toBeNull()
  })

  it('draws nothing where accounts are not available', () => {
    renderWithAccount(<AccountMenu />, 'unavailable')
    expect(
      screen.queryByRole('button', { name: accountCopy.sidebarSignIn }),
    ).toBeNull()
  })

  // A 401 from the gate is the passcode session running out, not a
  // deployment without accounts: the two must not read the same.
  it('says the lab session ended when the gate refuses the read', () => {
    renderWithAccount(<AccountMenu />, 'locked')
    const button = screen.getByRole('button', {
      name: accountCopy.locked.sidebarAria,
    })
    expect(button.textContent).toContain(accountCopy.locked.sidebar)
    expect(
      screen.queryByRole('button', { name: accountCopy.sidebarSignIn }),
    ).toBeNull()
  })

  // The whole app is behind the gate, so its 401 is read from the read
  // itself, not from anything the handler can say.
  it('reads the gate 401 as the lab session ending', async () => {
    serveAccount('locked')
    renderWithAccount(<AccountMenu />, 'loading')
    expect(
      await screen.findByRole('button', {
        name: accountCopy.locked.sidebarAria,
      }),
    ).toBeTruthy()
  })

  it('offers to sign in when signed out, and opens the dialog', () => {
    renderWithAccount(<AccountMenu />, 'signed-out')
    fireEvent.click(
      screen.getByRole('button', { name: accountCopy.sidebarSignIn }),
    )
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
      await screen.findByRole('button', { name: accountCopy.sidebarSignIn }),
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

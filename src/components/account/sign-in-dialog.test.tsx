import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const client = {
  sendSignInCode: vi.fn(),
  signInWithCode: vi.fn(),
  signInWithGoogle: vi.fn(),
}
vi.mock('@/lib/account/actions', () => ({
  loadAuthClient: async () => client,
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { accountCopy } from '@/copy/account'
import { toast } from '@/lib/toast'
import { useSignInDialog } from '@/stores/sign-in-dialog-store'
import { SignInDialog } from './sign-in-dialog'
import { renderWithAccount, serveAccount } from './test-utils'

const copy = accountCopy.dialog

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.clearAllMocks()
  useSignInDialog.setState({ open: true })
})

function typeEmail(email: string) {
  fireEvent.change(screen.getByLabelText(copy.emailLabel), {
    target: { value: email },
  })
  fireEvent.click(screen.getByRole('button', { name: copy.sendCode }))
}

describe('SignInDialog', () => {
  it('is closed until something opens it', () => {
    useSignInDialog.setState({ open: false })
    renderWithAccount(<SignInDialog />, 'signed-out')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('emails a code, then signs in with it', async () => {
    client.sendSignInCode.mockResolvedValue({ ok: true })
    client.signInWithCode.mockResolvedValue({ ok: true })
    const served = serveAccount('signed-in')
    const { client: queries } = renderWithAccount(
      <SignInDialog />,
      'signed-out',
    )
    const invalidate = vi.spyOn(queries, 'invalidateQueries')

    typeEmail(' Ada@Example.com ')
    expect(
      await screen.findByText(copy.codeSent('ada@example.com')),
    ).toBeTruthy()
    expect(client.sendSignInCode).toHaveBeenCalledWith('ada@example.com')

    fireEvent.change(screen.getByLabelText(copy.codeLabel), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: copy.verify }))

    await waitFor(() => expect(useSignInDialog.getState().open).toBe(false))
    expect(client.signInWithCode).toHaveBeenCalledWith(
      'ada@example.com',
      '123456',
    )
    expect(invalidate).toHaveBeenCalled()
    expect(served).toHaveBeenCalledWith('/api/account', expect.anything())
    expect(toast.success).toHaveBeenCalledWith(accountCopy.signedIn)
  })

  it('checks the address before sending anything', async () => {
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('not an address')
    expect((await screen.findByRole('alert')).textContent).toBe(
      accountCopy.errors.invalidEmail,
    )
    expect(client.sendSignInCode).not.toHaveBeenCalled()
  })

  it('shows why a code could not be sent, and stays on the email step', async () => {
    client.sendSignInCode.mockResolvedValue({
      ok: false,
      message: 'Too many codes sent to that address.',
    })
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('ada@example.com')
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Too many codes sent to that address.',
    )
    expect(screen.getByLabelText(copy.emailLabel)).toBeTruthy()
  })

  it('keeps the dialog open on a wrong code, saying so', async () => {
    client.sendSignInCode.mockResolvedValue({ ok: true })
    client.signInWithCode.mockResolvedValue({
      ok: false,
      message: accountCopy.errors.wrongCode,
    })
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('ada@example.com')
    fireEvent.change(await screen.findByLabelText(copy.codeLabel), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByRole('button', { name: copy.verify }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      accountCopy.errors.wrongCode,
    )
    expect(useSignInDialog.getState().open).toBe(true)
  })

  it('refuses a code that is not six digits without asking the server', async () => {
    client.sendSignInCode.mockResolvedValue({ ok: true })
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('ada@example.com')
    fireEvent.change(await screen.findByLabelText(copy.codeLabel), {
      target: { value: '12' },
    })
    fireEvent.click(screen.getByRole('button', { name: copy.verify }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      accountCopy.errors.invalidCode,
    )
    expect(client.signInWithCode).not.toHaveBeenCalled()
  })

  it('sends a new code on request, and goes back to change the address', async () => {
    client.sendSignInCode.mockResolvedValue({ ok: true })
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('ada@example.com')
    fireEvent.click(await screen.findByRole('button', { name: copy.resend }))
    expect(await screen.findByText(copy.resent)).toBeTruthy()
    expect(client.sendSignInCode).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: copy.useAnotherEmail }))
    expect(screen.getByLabelText(copy.emailLabel)).toBeTruthy()
  })

  // Both steps put a form with one input in the same place, so without its own
  // key React reuses the email field as the code field, typed text and all.
  it('starts each step with an empty field, in both directions', async () => {
    client.sendSignInCode.mockResolvedValue({ ok: true })
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('ada@example.com')
    const code = (await screen.findByLabelText(
      copy.codeLabel,
    )) as HTMLInputElement
    expect(code.value).toBe('')

    fireEvent.change(code, { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: copy.useAnotherEmail }))
    const email = screen.getByLabelText(copy.emailLabel) as HTMLInputElement
    expect(email.value).toBe('')
  })

  it('offers Google only where it is configured', () => {
    renderWithAccount(<SignInDialog />, 'signed-out')
    expect(screen.queryByRole('button', { name: copy.google })).toBeNull()
  })

  it('starts Google sign-in, back to this page afterwards', async () => {
    client.signInWithGoogle.mockReturnValue(new Promise(() => {}))
    renderWithAccount(<SignInDialog />, 'signed-out', { google: true })
    fireEvent.click(screen.getByRole('button', { name: copy.google }))
    await waitFor(() =>
      expect(client.signInWithGoogle).toHaveBeenCalledWith(
        window.location.pathname + window.location.search,
      ),
    )
    expect(screen.getByRole('button', { name: copy.redirecting })).toBeTruthy()
  })
})

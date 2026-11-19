import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
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
import { openSignIn, useSignInDialog } from '@/stores/sign-in-dialog-store'
import { SignInDialog } from './sign-in-dialog'
import { renderWithAccount, serveAccount } from './test-utils'

const copy = accountCopy.dialog

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.clearAllMocks()
  useSignInDialog.setState({ open: true, progress: null })
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
    expect(toast.success).toHaveBeenCalledWith(
      accountCopy.signedIn('ada@example.com'),
    )
    // Signed in: nothing left to come back to.
    expect(useSignInDialog.getState().progress).toBeNull()
  })

  it('checks the address before sending anything', async () => {
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('')
    expect((await screen.findByRole('alert')).textContent).toBe(
      accountCopy.errors.invalidEmail,
    )
    expect(client.sendSignInCode).not.toHaveBeenCalled()
  })

  it('says a half-typed address is not a full one, and goes back to it', async () => {
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('foo@bar')
    expect((await screen.findByRole('alert')).textContent).toBe(
      accountCopy.errors.notAnEmail,
    )
    expect(client.sendSignInCode).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByLabelText(copy.emailLabel))
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
  it('starts the code step empty, and keeps the address on the way back', async () => {
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
    // A typo is one character to fix, not the whole address again.
    expect(email.value).toBe('ada@example.com')
    // The code that was sent is abandoned, so reopening asks for the address.
    expect(useSignInDialog.getState().progress).toEqual({
      email: 'ada@example.com',
      codeSentAt: null,
    })
    fireEvent.click(screen.getByRole('button', { name: copy.sendCode }))
    expect(
      ((await screen.findByLabelText(copy.codeLabel)) as HTMLInputElement)
        .value,
    ).toBe('')
  })

  it('keeps only the digits of a pasted code', async () => {
    client.sendSignInCode.mockResolvedValue({ ok: true })
    client.signInWithCode.mockResolvedValue({ ok: true })
    serveAccount('signed-in')
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('ada@example.com')
    const code = (await screen.findByLabelText(
      copy.codeLabel,
    )) as HTMLInputElement
    // Pasted from an email that broke the code in two.
    fireEvent.change(code, { target: { value: '123 456' } })
    expect(code.value).toBe('123456')
    fireEvent.click(screen.getByRole('button', { name: copy.verify }))
    await waitFor(() =>
      expect(client.signInWithCode).toHaveBeenCalledWith(
        'ada@example.com',
        '123456',
      ),
    )
  })

  it('comes back to the code step while the code is still good', async () => {
    useSignInDialog.setState({
      progress: { email: 'ada@example.com', codeSentAt: Date.now() },
    })
    renderWithAccount(<SignInDialog />, 'signed-out')
    expect(screen.getByText(copy.codeSent('ada@example.com'))).toBeTruthy()
    expect(client.sendSignInCode).not.toHaveBeenCalled()
  })

  it('asks for the address again once the code has expired', () => {
    useSignInDialog.setState({
      progress: {
        email: 'ada@example.com',
        codeSentAt: Date.now() - 11 * 60_000,
      },
    })
    renderWithAccount(<SignInDialog />, 'signed-out')
    const email = screen.getByLabelText(copy.emailLabel) as HTMLInputElement
    expect(email.value).toBe('ada@example.com')
  })

  it('says the code is spent on the last wrong try, not the one after', async () => {
    client.sendSignInCode.mockResolvedValue({ ok: true })
    client.signInWithCode.mockResolvedValue({
      ok: false,
      message: accountCopy.errors.wrongCode,
      reason: 'wrong-code',
    })
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('ada@example.com')
    const code = await screen.findByLabelText(copy.codeLabel)

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      fireEvent.change(code, { target: { value: `00000${attempt}` } })
      fireEvent.click(screen.getByRole('button', { name: copy.verify }))
      const expected =
        attempt < 5
          ? accountCopy.errors.wrongCode
          : accountCopy.errors.tooManyAttempts
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toBe(expected),
      )
      // The wrong code is selected, ready to be typed over.
      expect(document.activeElement).toBe(code)
    }
    expect(client.signInWithCode).toHaveBeenCalledTimes(5)
  })

  it('counts the attempts again after a new code', async () => {
    client.sendSignInCode.mockResolvedValue({ ok: true })
    client.signInWithCode.mockResolvedValue({
      ok: false,
      message: accountCopy.errors.wrongCode,
      reason: 'wrong-code',
    })
    renderWithAccount(<SignInDialog />, 'signed-out')
    typeEmail('ada@example.com')
    const code = await screen.findByLabelText(copy.codeLabel)
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      fireEvent.change(code, { target: { value: `00000${attempt}` } })
      fireEvent.click(screen.getByRole('button', { name: copy.verify }))
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    }
    fireEvent.click(screen.getByRole('button', { name: copy.resend }))
    expect(await screen.findByText(copy.resent)).toBeTruthy()
    fireEvent.change(code, { target: { value: '111111' } })
    fireEvent.click(screen.getByRole('button', { name: copy.verify }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        accountCopy.errors.wrongCode,
      ),
    )
  })

  // There is no DialogTrigger to hand focus back to, so losing it here sends
  // a keyboard user to the top of the page.
  describe('focus', () => {
    // The sidebar around the dialog: something that opens it, and the
    // account entry that replaces it once someone is signed in.
    function Opener() {
      const [gone, setGone] = useState(false)
      return (
        <>
          {!gone && (
            <button type="button" onClick={openSignIn}>
              Open
            </button>
          )}
          <button type="button" data-account-menu="">
            Account
          </button>
          {/* The open dialog hides the rest of the page from the
              accessibility tree, so this one is reached by id. */}
          <button id="replace" type="button" onClick={() => setGone(true)}>
            Replace the opener
          </button>
          <SignInDialog />
        </>
      )
    }

    it('returns focus to whatever opened it', async () => {
      useSignInDialog.setState({ open: false })
      renderWithAccount(<Opener />, 'signed-out')
      const opener = screen.getByRole('button', { name: 'Open' })
      opener.focus()
      fireEvent.click(opener)
      await screen.findByRole('dialog')

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      await waitFor(() => expect(document.activeElement).toBe(opener))
    })

    it('falls back to the account entry when the opener has gone', async () => {
      useSignInDialog.setState({ open: false })
      renderWithAccount(<Opener />, 'signed-out')
      const opener = screen.getByRole('button', { name: 'Open' })
      opener.focus()
      fireEvent.click(opener)
      await screen.findByRole('dialog')

      // What a successful sign-in does: the button it was opened from is
      // replaced by the account menu.
      fireEvent.click(document.getElementById('replace')!)
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('button', { name: 'Account' }),
        ),
      )
    })

    it('keeps focus on "Send a new code" while it is sending', async () => {
      let release = () => {}
      client.sendSignInCode
        .mockResolvedValueOnce({ ok: true })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              release = () => resolve({ ok: true })
            }),
        )
      renderWithAccount(<SignInDialog />, 'signed-out')
      typeEmail('ada@example.com')
      const resend = await screen.findByRole('button', { name: copy.resend })
      resend.focus()
      fireEvent.click(resend)

      // Busy, and still the focused element: `disabled` would have dropped
      // focus to the body the moment it was pressed.
      await waitFor(() =>
        expect(screen.getByRole('button', { name: copy.sending })).toBeTruthy(),
      )
      expect(document.activeElement).toBe(resend)
      expect(resend.getAttribute('aria-disabled')).toBe('true')

      release()
      await screen.findByText(copy.resent)
      // The stale code is gone and the field has the keyboard back.
      expect(document.activeElement).toBe(screen.getByLabelText(copy.codeLabel))
    })

    it('turns away a second press while busy', async () => {
      client.sendSignInCode.mockReturnValue(new Promise(() => {}))
      renderWithAccount(<SignInDialog />, 'signed-out')
      typeEmail('ada@example.com')
      const send = await screen.findByRole('button', { name: copy.sending })
      fireEvent.click(send)
      fireEvent.click(send)
      expect(client.sendSignInCode).toHaveBeenCalledTimes(1)
    })
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

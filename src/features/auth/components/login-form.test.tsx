import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { accountCopy } from '@/copy/account'

import { authCopy } from '../copy'
import { LoginForm } from './login-form'

describe('LoginForm', () => {
  it('asks for the lab passcode, with its own verb', () => {
    render(<LoginForm />)
    expect(
      screen.getByRole('heading', { name: authCopy.login.title }),
    ).toBeTruthy()
    const submit = screen.getByRole('button', { name: authCopy.login.submit })
    expect(submit.closest('form')?.getAttribute('action')).toBe('/api/login')
  })

  // Three auditors read the sidebar's account entry as a second attempt at
  // the passcode. The two steps are different things and must not share a
  // verb, whichever words either one ends up with.
  it('does not share its wording with the account sign-in', () => {
    const passcodeWords = [
      authCopy.login.title,
      authCopy.login.submit,
      authCopy.login.pageTitle,
    ]
    expect(passcodeWords).not.toContain(accountCopy.sidebarSignIn)
    // The account's own verb, wherever it is used.
    expect(passcodeWords).not.toContain('Sign in')
  })

  // Password managers otherwise file the passcode under "no username".
  it('gives password managers a username to file the passcode under', () => {
    const { container } = render(<LoginForm />)
    const username = container.querySelector<HTMLInputElement>(
      'input[autocomplete="username"]',
    )
    expect(username?.value).toBe(authCopy.login.passwordManagerUsername)
    expect(username?.hidden).toBe(true)
    expect(username?.form?.getAttribute('action')).toBe('/api/login')
  })

  // The ?error= message renders only after hydration, so without JavaScript
  // this note is the only thing the page can say about a refused attempt.
  it('says what a refusal looks like without JavaScript', () => {
    const { container } = render(<LoginForm />)
    const note = container.querySelector('noscript')
    expect(note?.textContent).toContain(authCopy.login.noScript)
    // It is served for every /login URL, so it must claim nothing about this
    // one: not that the passcode was refused, nor where the visitor was going.
    expect(authCopy.login.noScript).not.toContain(authCopy.login.wrongPasscode)
  })
})

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
    expect(passcodeWords).not.toContain(accountCopy.signIn)
  })
})

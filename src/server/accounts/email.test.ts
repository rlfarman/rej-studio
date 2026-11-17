// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { handleDevMailbox } from './dev-mailbox'
import { SIGN_IN_CODE_MINUTES, sendSignInCode } from './email'
import { fakeEmail } from './test-utils'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sendSignInCode', () => {
  it('emails the code through the binding, from AUTH_EMAIL_FROM', async () => {
    const mailbox = fakeEmail()
    const outcome = await sendSignInCode(
      { AUTH_EMAIL: mailbox.binding, AUTH_EMAIL_FROM: 'sign-in@rejstudio.com' },
      { to: 'ada@example.com', code: '123456', local: false },
    )
    expect(outcome).toBe('sent')
    expect(mailbox.sent).toHaveLength(1)
    const [message] = mailbox.sent
    expect(message).toMatchObject({
      to: 'ada@example.com',
      from: { email: 'sign-in@rejstudio.com', name: 'REJ Studio' },
    })
    expect(message.subject).toContain('123456')
    expect(message.text).toContain('123456')
    expect(message.text).toContain(`${SIGN_IN_CODE_MINUTES} minutes`)
  })

  it('needs a from address to send', async () => {
    const mailbox = fakeEmail()
    await expect(
      sendSignInCode(
        { AUTH_EMAIL: mailbox.binding },
        { to: 'ada@example.com', code: '123456', local: false },
      ),
    ).rejects.toThrow(/AUTH_EMAIL_FROM/)
  })

  it('prints the code, loudly, for a local request with no binding', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const outcome = await sendSignInCode(
      {},
      { to: 'ada@example.com', code: '654321', local: true },
    )
    expect(outcome).toBe('logged')
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0][0])).toContain('654321')
  })

  it('refuses to print a code anywhere but locally', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      sendSignInCode({}, { to: 'ada@example.com', code: '1', local: false }),
    ).rejects.toThrow(/no AUTH_EMAIL binding/)
    expect(warn).not.toHaveBeenCalled()
  })

  it('propagates a failed send, so the caller can log it', async () => {
    const binding = {
      send: async () => {
        throw Object.assign(new Error('not verified'), {
          code: 'E_SENDER_NOT_VERIFIED',
        })
      },
    } as unknown as SendEmail
    await expect(
      sendSignInCode(
        { AUTH_EMAIL: binding, AUTH_EMAIL_FROM: 'sign-in@rejstudio.com' },
        { to: 'ada@example.com', code: '1', local: false },
      ),
    ).rejects.toThrow('not verified')
  })
})

describe('the test mailbox', () => {
  const read = (url: string, env: { AUTH_DEV_MAILBOX?: string }) =>
    handleDevMailbox(new Request(url), env)

  it('hands back the last code for an address, on localhost, when on', async () => {
    const env = { AUTH_DEV_MAILBOX: 'true', AUTH_EMAIL: fakeEmail().binding }
    await sendSignInCode(
      { ...env, AUTH_EMAIL_FROM: 'a@rejstudio.com' },
      { to: 'Mail@Example.com', code: '111111', local: true },
    )
    const response = read(
      'http://localhost:3000/api/dev/sign-in-code?email=mail@example.com',
      env,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ code: '111111' })
  })

  it('does not exist on any other host, even with the variable set', () => {
    const response = read(
      'https://rejstudio.com/api/dev/sign-in-code?email=mail@example.com',
      { AUTH_DEV_MAILBOX: 'true' },
    )
    expect(response.status).toBe(404)
  })

  it('keeps and gives nothing without the variable', async () => {
    await sendSignInCode(
      { AUTH_EMAIL: fakeEmail().binding, AUTH_EMAIL_FROM: 'a@rejstudio.com' },
      { to: 'quiet@example.com', code: '222222', local: true },
    )
    expect(
      read(
        'http://localhost:3000/api/dev/sign-in-code?email=quiet@example.com',
        {},
      ).status,
    ).toBe(404)
    expect(
      read(
        'http://localhost:3000/api/dev/sign-in-code?email=quiet@example.com',
        {
          AUTH_DEV_MAILBOX: 'true',
        },
      ).status,
    ).toBe(404)
  })
})

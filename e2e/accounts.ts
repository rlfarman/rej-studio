import { expect, type Page } from '@playwright/test'

import { accountCopy } from '../src/copy/account'

/**
 * Who is signed in to an account: the one request every page makes to the
 * Worker (the sidebar's account entry). It carries no gene or design data,
 * so the specs that check pages make no server calls leave it out.
 */
export const ACCOUNT_STATE_PATH = '/api/account'

/** A fresh address per test, so no run signs in to another's account. */
export function testEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

/**
 * The sign-in code last sent to `email`, from the test mailbox the e2e
 * server keeps (AUTH_DEV_MAILBOX, localhost only). Polled: the email goes
 * out after the response (waitUntil).
 */
export async function lastCode(page: Page, email: string): Promise<string> {
  let code = ''
  await expect(async () => {
    const response = await page.request.get(
      `/api/dev/sign-in-code?email=${encodeURIComponent(email)}`,
    )
    expect(response.status()).toBe(200)
    code = ((await response.json()) as { code: string }).code
  }).toPass({ timeout: 10_000 })
  return code
}

/** The sidebar's footer, where the account lives. */
function accountArea(page: Page) {
  return page.locator('[data-sidebar="footer"]')
}

/**
 * Signs in to the account for `email` through the dialog, as a person would:
 * the sidebar's "Sign in", the address, the emailed code. Needs a page past
 * the passcode.
 */
export async function signInToAccount(page: Page, email: string) {
  const dialog = accountCopy.dialog
  await accountArea(page)
    .getByRole('button', { name: accountCopy.signIn })
    .click()
  await page.getByLabel(dialog.emailLabel).fill(email)
  await page.getByRole('button', { name: dialog.sendCode }).click()
  await expect(page.getByText(dialog.codeSent(email))).toBeVisible()
  await page.getByLabel(dialog.codeLabel).fill(await lastCode(page, email))
  await page.getByRole('button', { name: dialog.verify }).click()
  await expect(
    accountArea(page).getByRole('button', {
      name: accountCopy.accountMenuAria(email),
    }),
  ).toBeVisible()
}

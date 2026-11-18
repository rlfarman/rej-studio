import { expect, test } from '@playwright/test'

import { accountCopy } from '../src/copy/account'
import { designToolCopy } from '../src/features/design-tool/copy'
import { lastCode, signInToAccount, testEmail } from './accounts'
import { signIn } from './sign-in'

// Accounts on top of the passcode: signing in with an emailed code (read
// back from the dev server's test mailbox), signing out, the cloud toggle
// for someone without an account, and a cloud design listed on another
// device under "My cloud designs".

const GENE_PAGE = '/design-tool?isoform=ENST00000269305'
const cloud = designToolCopy.cloud

test('signs in with an emailed code, and out again', async ({ page }) => {
  await page.goto('/')
  const email = testEmail('sign-in')
  await signInToAccount(page, email)

  // Still signed in after a reload: the account cookie, not page state.
  await page.reload()
  const menu = page.getByRole('button', {
    name: accountCopy.accountMenuAria(email),
  })
  await expect(menu).toBeVisible()

  await menu.click()
  await page.getByRole('menuitem', { name: accountCopy.signOut }).click()
  await expect(
    page
      .locator('[data-sidebar="footer"]')
      .getByRole('button', { name: accountCopy.signIn }),
  ).toBeVisible()
})

test('refuses a wrong code and keeps the dialog open', async ({ page }) => {
  await page.goto('/')
  const email = testEmail('wrong-code')
  const dialog = accountCopy.dialog
  await page
    .locator('[data-sidebar="footer"]')
    .getByRole('button', { name: accountCopy.signIn })
    .click()
  await page.getByLabel(dialog.emailLabel).fill(email)
  await page.getByRole('button', { name: dialog.sendCode }).click()
  const right = await lastCode(page, email)
  await page
    .getByLabel(dialog.codeLabel)
    .fill(right === '000000' ? '111111' : '000000')
  await page.getByRole('button', { name: dialog.verify }).click()
  await expect(page.getByRole('alert')).toHaveText(accountCopy.errors.wrongCode)
  await expect(page.getByLabel(dialog.codeLabel)).toBeVisible()
})

test('the cloud toggle asks someone without an account to sign in', async ({
  page,
}) => {
  await page.goto(GENE_PAGE)
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)

  const toggle = page.getByRole('checkbox', { name: cloud.toggleLabel })
  await expect(toggle).toBeDisabled()
  await expect(toggle).not.toBeChecked()
  await expect(page.getByText(cloud.signInHint)).toBeVisible()

  await page
    .locator('main')
    .getByRole('button', { name: cloud.signInAction })
    .click()
  await expect(
    page.getByRole('dialog', { name: accountCopy.dialog.title }),
  ).toBeVisible()
})

test('a cloud design shows under My cloud designs on another device', async ({
  browser,
  page,
}) => {
  const email = testEmail('my-designs')
  await page.goto(GENE_PAGE)
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)
  await signInToAccount(page, email)

  const name = `My designs e2e ${Date.now()}`
  await page.locator('input[name="name"]').fill(name)
  await page.getByRole('checkbox', { name: cloud.toggleLabel }).click()
  await page.getByRole('button', { name: /run designer/i }).click()
  await expect(page).toHaveURL(/[?&]job=[0-9a-f]{64}/)
  const jobId = new URL(page.url()).searchParams.get('job')!
  await expect(page.getByText(/split after base/i).first()).toBeVisible({
    timeout: 60_000,
  })

  // Another device: no history, its own passcode sign-in, the same account.
  const elsewhere = await browser.newContext({ storageState: undefined })
  const other = await elsewhere.newPage()
  await signIn(other)
  const myDesigns = other.getByRole('button', {
    name: cloud.myDesigns.label,
  })
  await expect(other.getByText(name)).toHaveCount(0)
  await signInToAccount(other, email)
  await expect(myDesigns).toBeVisible()
  await other.getByText(name).click()
  await expect(other).toHaveURL(new RegExp(`[?&]job=${jobId}`))
  await expect(other.getByText(/split after base/i).first()).toBeVisible({
    timeout: 60_000,
  })
  // Now in that browser's own history: listed once, under Recent jobs.
  await expect(
    other.locator('[data-sidebar="content"]').getByText(name),
  ).toHaveCount(1)
  await elsewhere.close()
})

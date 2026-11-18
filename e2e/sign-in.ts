import { expect, type Page } from '@playwright/test'

import { authCopy } from '../src/features/auth/copy'

import { E2E_PASSWORD } from './constants'

/** Signs in through the real login form, as a person would. */
export async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/passcode/i).fill(E2E_PASSWORD)
  await page.getByRole('button', { name: authCopy.login.submit }).click()
  await expect(page).toHaveURL(/\/$/)
}

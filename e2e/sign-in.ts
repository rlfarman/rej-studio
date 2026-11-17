import { expect, type Page } from '@playwright/test'

import { E2E_PASSWORD } from './constants'

/** Signs in through the real login form, as a person would. */
export async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/passcode/i).fill(E2E_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/$/)
}

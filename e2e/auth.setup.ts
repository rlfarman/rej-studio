import { expect, test as setup } from '@playwright/test'
import { E2E_PASSWORD, STORAGE_STATE } from './constants'

// Sign in once through the real login form and save the session cookie for
// the signed-in specs.
setup('sign in through the login form', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Password').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')
  await page.context().storageState({ path: STORAGE_STATE })
})

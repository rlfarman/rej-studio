import { expect, test } from '@playwright/test'

import { authCopy } from '../src/features/auth/copy'

import { E2E_PASSWORD } from './constants'

// The passcode gate, signed out (this project has no saved session).

test('a signed-out visit goes to the login page and back after', async ({
  page,
}) => {
  await page.goto('/genes/TP53')
  await expect(page).toHaveURL(/\/login\?return_to=%2Fgenes%2FTP53$/)
  // The login page stands alone: no sidebar.
  await expect(page.getByRole('navigation')).toHaveCount(0)

  await page.getByLabel(/passcode/i).fill(E2E_PASSWORD)
  await page.getByRole('button', { name: authCopy.login.submit }).click()
  await expect(page).toHaveURL(/\/genes\/TP53$/)
  await expect(page.getByRole('heading', { name: 'TP53' })).toBeVisible()
})

test('a wrong passcode is refused, and says so', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/passcode/i).fill('not-the-passcode')
  await page.getByRole('button', { name: authCopy.login.submit }).click()
  await expect(page).toHaveURL(/\/login\?error=passcode/)
  await expect(page.getByRole('alert')).toBeVisible()
})

test('a signed-out API call gets 401', async ({ request }) => {
  const response = await request.get('/api/version')
  expect(response.status()).toBe(401)
})

test('the MCP endpoint is not behind the gate', async ({ request }) => {
  // It has its own bearer tokens; none are configured here, so 503.
  const response = await request.post('/api/mcp', { data: {} })
  expect(response.status()).not.toBe(401)
})

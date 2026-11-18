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

// Every /login URL is answered with the prerendered login page rather than
// the SPA shell (src/server/prerendered-pages.ts), so a visitor without
// JavaScript gets the form after a refusal. The same HTML therefore has to
// hydrate cleanly under each query string the gate and /api/login produce.
for (const path of [
  '/login',
  '/login?error=passcode',
  '/login?return_to=%2Fgenes%2FTP53',
]) {
  test(`${path} hydrates the login form`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      // The sidebar mounts here and asks /api/account who is signed in; with
      // no session the gate answers 401, which `fetchAccount` reads as
      // "locked" and renders. The browser logs every 401 whatever the page
      // does with it, so that one line is the expected answer, not a fault.
      // Everything else — a hydration mismatch above all — still fails.
      const expected401 = message.text().includes('401 (Unauthorized)')
      if (message.type() === 'error' && !expected401)
        errors.push(message.text())
    })

    await page.goto(path)
    await expect(
      page.getByRole('heading', { level: 1, name: authCopy.login.title }),
    ).toBeVisible()
    // Hydrated: the form stands alone, without the app's chrome.
    await expect(page.getByRole('navigation')).toHaveCount(0)
    // The refusal message is in the page only for the URL that carries it.
    await expect(page.getByRole('alert')).toHaveCount(
      path.includes('error=') ? 1 : 0,
    )
    // The note a visitor without JavaScript reads instead; inert here.
    await expect(page.locator('noscript')).toHaveCount(1)
    expect(errors).toEqual([])
  })
}

test('a signed-out API call gets 401', async ({ request }) => {
  const response = await request.get('/api/version')
  expect(response.status()).toBe(401)
})

test('the MCP endpoint is not behind the gate', async ({ request }) => {
  // It has its own bearer tokens; none are configured here, so 503.
  const response = await request.post('/api/mcp', { data: {} })
  expect(response.status()).not.toBe(401)
})

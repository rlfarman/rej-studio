import { expect, test } from '@playwright/test'
import { E2E_PASSWORD } from './constants'

test('a gene page redirects to login and returns there after sign-in', async ({
  page,
}) => {
  await page.goto('/genes/TP53?species=human')
  await expect(page).toHaveURL(
    '/login?return_to=%2Fgenes%2FTP53%3Fspecies%3Dhuman',
  )

  await page.getByLabel('Password').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL('/genes/TP53?species=human')
  await expect(page.getByText('ENST00000269305').first()).toBeVisible()
})

test('a wrong password stays on the login page', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/login\?error=1/)
})

test('public images load without a session, directly and via next/image', async ({
  request,
}) => {
  // The image optimizer fetches the source internally without cookies, so a
  // gated /branding/*.png broke the sidebar logo for signed-in users too.
  const raw = await request.get('/branding/SalkLogo-WCB-K.png', {
    maxRedirects: 0,
  })
  expect(raw.status()).toBe(200)
  expect(raw.headers()['content-type']).toContain('image/png')

  const optimized = await request.get(
    '/_next/image?url=%2Fbranding%2FSalkLogo-WCB-K.png&w=64&q=75',
    { maxRedirects: 0 },
  )
  expect(optimized.status()).toBe(200)
  expect(optimized.headers()['content-type']).toMatch(/^image\//)
})

test('server actions reject callers without a session', async ({ request }) => {
  const response = await request.post('/design-tool', {
    headers: { 'Next-Action': 'e2e-unknown-action' },
    data: '[]',
  })
  expect(response.status()).toBe(401)
})

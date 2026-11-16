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

test('the MCP endpoint does not exist until tokens are configured', async ({
  request,
}) => {
  // The dev server Playwright starts sets no MCP_TOKENS, so a deployment that
  // has not decided about agent access must not have an agent surface. It is
  // also not behind the password gate, which would make it a 401 instead.
  const response = await request.post('/api/mcp', {
    headers: { 'content-type': 'application/json' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  })

  expect(response.status()).toBe(404)
})

test('the MCP view can load its client library from a chat host', async ({
  request,
}) => {
  // The view runs on the host's origin, never ours, and a module script is
  // fetched with CORS. Without these headers it cannot load at all — in any
  // host — and the view renders empty.
  const response = await request.get('/mcp/app-bridge.js')

  expect(response.status()).toBe(200)
  expect(response.headers()['access-control-allow-origin']).toBe('*')
  expect(response.headers()['content-type']).toContain('javascript')
})

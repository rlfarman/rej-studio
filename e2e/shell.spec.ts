import { expect, test, type Page } from '@playwright/test'

import { appCopy } from '../src/copy/app'
import { commonCopy } from '../src/copy/common'

// The TanStack Start app shell: every route renders inside the sidebar and
// header, the sidebar navigates, the theme persists, and an unknown URL gets
// the not-found page. Expected text comes from the copy files rather than
// being repeated here.

const ROUTES = [
  { path: '/', heading: appCopy.home.ogTitle },
  { path: '/genes', heading: commonCopy.pageContext.genes },
  { path: '/genes/TP53', heading: 'TP53' },
  { path: '/design-tool', heading: commonCopy.pageContext.designTool },
  {
    path: '/disease-associations',
    heading: commonCopy.pageContext.diseaseAssociations,
  },
  { path: '/architecture', heading: commonCopy.pageContext.architecture },
]

const nav = appCopy.sidebar.nav

function sidebarLink(page: Page, name: string) {
  return page.locator('[data-slot="sidebar"]').getByRole('link', { name })
}

for (const { path, heading } of ROUTES) {
  test(`${path} renders inside the shell`, async ({ page }) => {
    // Every URL hydrates the same prerendered shell, so anything in it that
    // depends on the URL would surface here as a hydration error.
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })

    await page.goto(path)
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
    // The page sits in the shell's <main>, next to the sidebar.
    await expect(page.locator('main#main-content h1')).toHaveText(heading)
    await expect(sidebarLink(page, nav.home)).toBeVisible()
    // Hydrated: the nav link for this page is marked active.
    await expect(
      page.locator('[data-slot="sidebar"] a[data-active]'),
    ).toHaveCount(
      path === '/' ||
        path === '/design-tool' ||
        path === '/disease-associations'
        ? 1
        : 0,
    )
    expect(errors).toEqual([])
  })
}

test('sidebar links navigate and mark the active page', async ({ page }) => {
  await page.goto('/')
  await expect(sidebarLink(page, nav.home)).toHaveAttribute('data-active', '')

  await sidebarLink(page, nav.designTool).click()
  await expect(page).toHaveURL('/design-tool')
  await expect(
    page.getByRole('heading', { name: commonCopy.pageContext.designTool }),
  ).toBeVisible()
  await expect(sidebarLink(page, nav.designTool)).toHaveAttribute(
    'data-active',
    '',
  )
  await expect(sidebarLink(page, nav.home)).not.toHaveAttribute('data-active')

  await sidebarLink(page, nav.diseaseAssociations).click()
  await expect(page).toHaveURL('/disease-associations')
  await expect(
    page.getByRole('heading', {
      name: commonCopy.pageContext.diseaseAssociations,
    }),
  ).toBeVisible()
})

test('a deep link loads the page directly', async ({ page }) => {
  // The server answers every route with the same SPA shell; the client
  // renders the page for the URL it finds.
  const response = await page.goto('/genes/BRCA1?species=human')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'BRCA1' })).toBeVisible()
  await expect(page).toHaveTitle(appCopy.metadata.title('BRCA1'))

  // A hard refresh on a deep link gets the shell again, not a 404.
  const reloaded = await page.reload()
  expect(reloaded?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'BRCA1' })).toBeVisible()
})

test('serves the optimizer as application/wasm', async ({ request }) => {
  // WebAssembly.instantiateStreaming refuses any other content type.
  const response = await request.get('/optimizer/rej-optimizer.wasm')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('application/wasm')
  const notices = await request.get('/optimizer/THIRD-PARTY-NOTICES.md')
  expect(notices.status()).toBe(200)
})

test('the theme toggles and persists across a reload', async ({ page }) => {
  await page.goto('/')
  const html = page.locator('html')

  const choose = async (theme: string) => {
    // The prerendered shell has no active nav link; one appears once React
    // has hydrated, so the menu button below responds to the click.
    await expect(sidebarLink(page, nav.home)).toHaveAttribute('data-active', '')
    await page.getByRole('button', { name: commonCopy.menu.settings }).click()
    await page.getByRole('menuitemradio', { name: theme }).click()
  }

  await choose(commonCopy.menu.theme.dark)
  await expect(html).toHaveClass(/\bdark\b/)
  await page.reload()
  await expect(html).toHaveClass(/\bdark\b/)

  await choose(commonCopy.menu.theme.light)
  await expect(html).not.toHaveClass(/\bdark\b/)
  await page.reload()
  await expect(html).not.toHaveClass(/\bdark\b/)
})

test('an unknown URL shows the not-found page', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(
    page.getByRole('heading', { name: appCopy.notFound.description }),
  ).toBeVisible()
  // In the page slot, with the sidebar still there to navigate away.
  await expect(page.locator('main#main-content h1')).toHaveText(
    appCopy.notFound.description,
  )
  await expect(page.locator('main')).toHaveCount(1)
  await sidebarLink(page, nav.home).click()
  await expect(page).toHaveURL('/')
})

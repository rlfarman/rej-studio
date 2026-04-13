import { test, expect } from '@playwright/test'

test.describe('home page', () => {
  test('renders hero and gene search', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: /what gene are you optimizing/i }),
    ).toBeVisible()

    await expect(
      page.getByRole('link', { name: /design your own/i }),
    ).toHaveAttribute('href', /\/design-tool\?gene=ATM/)
  })

  test('navigates to design tool via "design your own" link', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /design your own/i }).click()
    await expect(page).toHaveURL(/\/design-tool\?gene=ATM/)
  })
})

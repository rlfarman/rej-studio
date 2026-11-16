import { expect, test } from '@playwright/test'

// Signed in via auth.setup.ts. Assertions target roles and data rather than
// copy, so wording and layout changes don't break them.

test('home renders the gene search', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('combobox').first()).toBeVisible()
})

test('the TP53 gene page lists its isoforms', async ({ page }) => {
  await page.goto('/genes/TP53?species=human')
  await expect(page.getByRole('heading', { name: 'TP53' })).toBeVisible()
  await expect(page.getByText('ENST00000269305').first()).toBeVisible()
})

test('the design tool prefills the coding sequence from an isoform', async ({
  page,
}) => {
  await page.goto('/design-tool?isoform=ENST00000269305')
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)
})

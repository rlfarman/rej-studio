import { expect, test } from '@playwright/test'

// Assertions target roles and data rather than copy, so wording and layout
// changes don't break them.
//
// fixme: the pages are placeholders until slice 2 ports them to TanStack Start.

test.fixme('home renders the gene search', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('combobox').first()).toBeVisible()
})

test.fixme('the TP53 gene page lists its isoforms', async ({ page }) => {
  await page.goto('/genes/TP53?species=human')
  await expect(page.getByRole('heading', { name: 'TP53' })).toBeVisible()
  await expect(page.getByText('ENST00000269305').first()).toBeVisible()
})

test.fixme('the design tool prefills the coding sequence from an isoform', async ({
  page,
}) => {
  await page.goto('/design-tool?isoform=ENST00000269305')
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)
})

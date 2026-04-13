import { test, expect } from '@playwright/test'

// A minimal valid CDS: starts with ATG, ends with TAA (stop), multiple of 3,
// no premature stops. Matches the validation in
// src/features/design-tool/types/form-schema.ts.
const VALID_CDS = 'ATGGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTTAA'

// Shadcn CardTitle renders a div, not a heading, so the Optimization and
// Review & Run sections are asserted via text rather than role=heading.
test.describe('design tool', () => {
  test('renders the form with the three main sections', async ({ page }) => {
    await page.goto('/design-tool')

    await expect(
      page.getByRole('heading', { name: 'REJ Studio Design Tool' }),
    ).toBeVisible()
    await expect(page.getByText('Optimization', { exact: true })).toBeVisible()
    await expect(page.getByText('Review & Run')).toBeVisible()
    await expect(
      page.getByRole('button', { name: /run optimizer/i }),
    ).toBeVisible()
  })

  test('shows validation error for an invalid coding sequence', async ({
    page,
  }) => {
    await page.goto('/design-tool')

    await page
      .getByRole('textbox', { name: /choose a name for your coding sequence/i })
      .fill('Invalid test')

    const sequence = page.getByPlaceholder(/^ATGATTACA/)
    await sequence.fill('ATGGCT')
    await sequence.blur()

    await expect(
      page.getByText(/multiple of 3|stop codon/i).first(),
    ).toBeVisible()
  })

  test('accepts a valid sequence and leaves the submit button enabled', async ({
    page,
  }) => {
    await page.goto('/design-tool')

    await page
      .getByRole('textbox', { name: /choose a name for your coding sequence/i })
      .fill('Valid test')

    const sequence = page.getByPlaceholder(/^ATGATTACA/)
    await sequence.fill(VALID_CDS)
    await sequence.blur()

    await expect(
      page.getByText(/multiple of 3|start codon|premature|valid nucleotides/i),
    ).toHaveCount(0)

    const submit = page.getByRole('button', { name: /run optimizer/i })
    await expect(submit).toBeEnabled()
  })
})

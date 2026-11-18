import { devices, expect, test } from '@playwright/test'

import { commonCopy } from '../src/copy/common'
import { designToolCopy } from '../src/features/design-tool/copy'

// On a phone these hints are the *only* explanation of WGGW, CpG, k-mer, the
// stimulatory introns and the split point — there is no docs page to fall back
// to. Base UI disables tooltips on touch devices, which is why `TermHint` is a
// popover; a real touch context is the only way to hold it to that. This is
// its own file because `devices[…]` sets `defaultBrowserType`, which
// Playwright only accepts at the top level of a file.
test.use({ ...devices['Pixel 7'] })

const form = designToolCopy.form
const objectives = designToolCopy.optimizationOptions

test('a hint opens on a tap and closes on Escape', async ({ page }) => {
  await page.goto('/design-tool', { waitUntil: 'networkidle' })
  await page
    .getByRole('button', {
      name: commonCopy.termHintAria(form.spliceJunctionLabel),
    })
    .first()
    .tap()
  await expect(page.getByText(form.spliceJunctionHelp)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText(form.spliceJunctionHelp)).toBeHidden()
})

test('a hint inside a checkbox label does not toggle the checkbox', async ({
  page,
}) => {
  await page.goto('/design-tool', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: objectives.summary.editAria }).tap()
  const label = objectives.codonOptimize.label
  const box = page.getByRole('checkbox', { name: label }).first()
  const before = await box.getAttribute('aria-checked')
  await page
    .getByRole('button', { name: commonCopy.termHintAria(label) })
    .first()
    .tap()
  await expect(page.getByText(objectives.help.codonOptimize)).toBeVisible()
  expect(await box.getAttribute('aria-checked')).toBe(before)
})

// The icon draws at 24px to sit on a line of text; the thing you tap is a
// pseudo-element stretched to the 44px minimum, which costs no layout.
test('a hint has a 44px hit area', async ({ page }) => {
  await page.goto('/design-tool', { waitUntil: 'networkidle' })
  const size = await page
    .getByRole('button', {
      name: commonCopy.termHintAria(form.spliceJunctionLabel),
    })
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el, '::before')
      return { width: style.width, height: style.height }
    })
  expect(size).toEqual({ width: '44px', height: '44px' })
})

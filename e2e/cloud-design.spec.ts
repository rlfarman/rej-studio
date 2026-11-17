import { expect, test } from '@playwright/test'

import { designToolCopy } from '../src/features/design-tool/copy'

// A cloud design, end to end: the toggle, POST /api/designs, the Workflow
// running in workerd under `vp dev`, and the result found again after the
// page that submitted it has closed.
//
// The dev server is started with DEV_ACCESS_EMAIL (playwright.config.ts),
// the local stand-in for a Cloudflare Access sign-in, honoured on localhost
// only.

const GENE_PAGE = '/design-tool?isoform=ENST00000269305'
const copy = designToolCopy.cloud

test('runs a design in the cloud, and finds it after the page closes', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.goto(GENE_PAGE)
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)

  // A name of its own, so this run is not an earlier run's design (the id is
  // a hash of the request, and the dev server keeps its Workflow state).
  const name = `Cloud e2e ${Date.now()}`
  await page.locator('input[name="name"]').fill(name)

  // Off by default, with its one line of copy in view.
  const toggle = page.getByRole('checkbox', { name: copy.toggleLabel })
  await expect(toggle).not.toBeChecked()
  await expect(page.getByText(copy.toggleHint)).toBeVisible()
  await toggle.click()

  const submitted = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/designs') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /run designer/i }).click()
  expect((await submitted).status()).toBe(202)

  // The cloud id goes in the URL, so the link reopens this design anywhere.
  await expect(page).toHaveURL(/[?&]job=[0-9a-f]{64}/)
  const jobId = new URL(page.url()).searchParams.get('job')!

  // Close the page that submitted it, whatever state it was in.
  await page.close()

  // Back later, in the same browser: the poller finds the result and history
  // keeps it.
  const later = await context.newPage()
  await later.goto(`/design-tool?job=${jobId}`)
  await expect(later.getByText(/split after base/i).first()).toBeVisible({
    timeout: 60_000,
  })
  await expect(later.getByText(name).first()).toBeVisible()
  await expect(
    later.getByRole('button', { name: copy.deleteAction }),
  ).toBeVisible()
  await later.close()
})

test('a cloud design link opens on another device, and its owner can delete it', async ({
  browser,
  page,
}) => {
  await page.goto(GENE_PAGE)
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)
  const name = `Cloud link e2e ${Date.now()}`
  await page.locator('input[name="name"]').fill(name)
  await page.getByRole('checkbox', { name: copy.toggleLabel }).click()
  await page.getByRole('button', { name: /run designer/i }).click()
  await expect(page).toHaveURL(/[?&]job=[0-9a-f]{64}/)
  const jobId = new URL(page.url()).searchParams.get('job')!
  await expect(page.getByText(/split after base/i).first()).toBeVisible({
    timeout: 60_000,
  })

  // A fresh browser context has no history at all: the design comes from
  // the cloud.
  const elsewhere = await browser.newContext()
  const other = await elsewhere.newPage()
  await other.goto(`/design-tool?job=${jobId}`)
  await expect(other.getByText(/split after base/i).first()).toBeVisible({
    timeout: 60_000,
  })
  await elsewhere.close()

  // The owner deletes it; this browser keeps its own copy.
  await page.getByRole('button', { name: copy.deleteAction }).click()
  await expect(page.getByText(copy.deletedNote)).toBeVisible()
  await expect(page.getByText(/split after base/i).first()).toBeVisible()

  const gone = await page.request.get(`/api/designs/${jobId}`)
  expect(gone.status()).toBe(404)
})

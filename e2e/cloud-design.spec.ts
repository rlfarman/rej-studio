import { expect, test, type Response } from '@playwright/test'

import { designToolCopy } from '../src/features/design-tool/copy'
import { SERVER_FN_BASE } from '../src/server/server-fns'
import { signIn } from './sign-in'

// A cloud design, end to end: the toggle, the submit server function, the
// Workflow running in workerd under `vp dev`, and the result found again
// after the page that submitted it has closed.

/** A call to one of the cloud-design server functions. */
function isServerFn(response: Response, method: 'GET' | 'POST'): boolean {
  return (
    new URL(response.url()).pathname.startsWith(`${SERVER_FN_BASE}/`) &&
    response.request().method() === method
  )
}

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

  // The submission carries the sequence; nothing else posted here does.
  const submitted = page.waitForResponse(
    (response) =>
      isServerFn(response, 'POST') &&
      (response.request().postData() ?? '').includes('codingSequence'),
  )
  await page.getByRole('button', { name: /run designer/i }).click()
  const answer = await submitted
  expect(answer.status()).toBe(202)
  expect(answer.headers()['cache-control']).toBe('no-store')

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

  // A fresh browser context has no history at all, and its own sign-in: the
  // design comes from the cloud.
  const elsewhere = await browser.newContext({ storageState: undefined })
  const other = await elsewhere.newPage()
  await signIn(other)
  await other.goto(`/design-tool?job=${jobId}`)
  await expect(other.getByText(/split after base/i).first()).toBeVisible({
    timeout: 60_000,
  })
  await elsewhere.close()

  // The owner deletes it; this browser keeps its own copy.
  await page.getByRole('button', { name: copy.deleteAction }).click()
  await expect(page.getByText(copy.deletedNote)).toBeVisible()
  await expect(page.getByText(/split after base/i).first()).toBeVisible()

  // Gone from the cloud: a browser with no copy of its own is told so.
  const fresh = await browser.newContext({ storageState: undefined })
  const late = await fresh.newPage()
  await signIn(late)
  const read = late.waitForResponse((response) => isServerFn(response, 'GET'))
  await late.goto(`/design-tool?job=${jobId}`)
  expect((await read).status()).toBe(404)
  await fresh.close()
})

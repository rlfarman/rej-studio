import { expect, test, type Page } from '@playwright/test'

// The in-browser optimizer, end to end through the real UI.
//
// The unit tests mock the worker and the Rust suite covers the optimizer
// itself; only a real browser can show that the three fit together — the
// WebAssembly loads, a design completes, progress moves, and nothing is sent
// to the compute backend.
//
// This project runs with NEXT_PUBLIC_ENABLE_BROWSER_OPTIMIZER=true (see
// playwright.config.ts); the other projects cover the default backend path.

// A real human CDS (TP53, ENST00000269305) — long enough to be a genuine
// design, short enough to finish quickly.
const GENE_PAGE = '/design-tool?isoform=ENST00000269305'

test('designs a sequence in the browser without calling the backend', async ({
  page,
}) => {
  const backendCalls: string[] = []
  const wasmRequests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/api/jobs')) backendCalls.push(url)
    if (url.includes('.wasm')) wasmRequests.push(url)
  })

  await page.goto(GENE_PAGE)
  const sequence = page.locator('textarea').first()
  await expect(sequence).toHaveValue(/^ATG[ACGT]+$/i)

  await page.getByRole('button', { name: /run designer/i }).click()

  // The design finishes and the split is reported.
  await expect(page.getByText(/split after base/i).first()).toBeVisible({
    timeout: 120_000,
  })

  // The optimizer was fetched once, and no job was ever submitted or polled.
  expect(wasmRequests.length).toBeGreaterThan(0)
  expect(backendCalls).toEqual([])
})

test('shows progress and offers to cancel while designing', async ({
  page,
}) => {
  await page.goto(GENE_PAGE)
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)

  await page.getByRole('button', { name: /run designer/i }).click()

  // A run in progress is cancellable; the button only appears for a running
  // job, so this also pins the status the hook reports during a browser run.
  // Exact match: the sidebar carries its own "Cancel <job name>" button.
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeVisible()

  await expect(page.getByText(/split after base/i).first()).toBeVisible({
    timeout: 120_000,
  })
})

test('a design made in the browser stays on this device', async ({ page }) => {
  await page.goto(GENE_PAGE)
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)

  await page.getByRole('button', { name: /run designer/i }).click()
  await expect(page.getByText(/split after base/i).first()).toBeVisible({
    timeout: 120_000,
  })

  // No ?job= in the URL: there is no backend job to share, and a link would
  // only 404 for whoever opened it.
  expect(new URL(page.url()).searchParams.get('job')).toBeNull()

  // It is still recorded locally, so Recent jobs and "Run again" work.
  await expect(page.getByText(/recent jobs/i).first()).toBeVisible()
})

// Design history lives in IndexedDB (localStorage tops out around 5 MB, and
// each entry carries full sequences). Reads the stored history's job names.
async function storedJobNames(page: Page): Promise<string[] | null> {
  return page.evaluate(
    () =>
      new Promise<string[] | null>((resolve, reject) => {
        const open = indexedDB.open('rej-studio-job-history')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const get = db
            .transaction('keyval', 'readonly')
            .objectStore('keyval')
            .get('rej-studio:job-history')
          get.onerror = () => reject(get.error)
          get.onsuccess = () => {
            const value = get.result as
              { state: { entries: { name: string }[] } } | undefined
            db.close()
            resolve(value ? value.state.entries.map((e) => e.name) : null)
          }
        }
      }),
  )
}

test('a design survives a reload, stored in IndexedDB', async ({ page }) => {
  await page.goto(GENE_PAGE)
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)
  const name = await page.locator('input[name="name"]').inputValue()

  await page.getByRole('button', { name: /run designer/i }).click()
  await expect(page.getByText(/split after base/i).first()).toBeVisible({
    timeout: 120_000,
  })
  await expect.poll(() => storedJobNames(page)).toContain(name)

  await page.reload()
  await expect(page.getByText(name).first()).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('rej-studio:job-history')),
  ).toBeNull()
})

test('an old localStorage history moves to IndexedDB', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const now = new Date().toISOString()
    localStorage.setItem(
      'rej-studio:job-history',
      JSON.stringify({
        version: 0,
        state: {
          entries: [
            {
              id: 'legacy-job-1',
              name: 'Legacy design',
              sequenceLength: 9,
              createdAt: now,
              status: 'failed',
              result: null,
              error: {
                code: 'unknown',
                message: 'Old failure',
                retriable: true,
              },
            },
          ],
        },
      }),
    )
  })

  await page.reload()
  await expect(page.getByText('Legacy design').first()).toBeVisible()
  await expect.poll(() => storedJobNames(page)).toEqual(['Legacy design'])
  expect(
    await page.evaluate(() => localStorage.getItem('rej-studio:job-history')),
  ).toBeNull()
})

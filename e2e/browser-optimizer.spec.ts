import { expect, test, type Page } from '@playwright/test'

import { ACCOUNT_STATE_PATH } from './accounts'

// The in-browser optimizer, end to end through the real UI.
//
// The unit tests mock the worker and the Rust suite covers the optimizer
// itself; only a real browser can show that the three fit together — the
// WebAssembly loads, a design completes, progress moves, and nothing is sent
// to the compute backend.
//
// The browser is the only place designs run, so nothing here needs a flag.

// A real human CDS (TP53, ENST00000269305) — long enough to be a genuine
// design, short enough to finish quickly.
const GENE_PAGE = '/design-tool?isoform=ENST00000269305'

test('designs a sequence in the browser without calling the backend', async ({
  page,
}) => {
  // Every request the page makes once it is up: the run itself must add
  // nothing but the optimizer's own files. (The sidebar reads who is signed
  // in to an account; that is not the design.)
  const backendCalls: string[] = []
  const wasmRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === ACCOUNT_STATE_PATH) return
    if (url.pathname.startsWith('/api/') || request.method() !== 'GET') {
      backendCalls.push(`${request.method()} ${url.pathname}`)
    }
    if (url.pathname.endsWith('.wasm')) wasmRequests.push(url.pathname)
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
              | { state: { entries: { name: string }[] } }
              | undefined
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

interface StoredEntry {
  id: string
  status: string
  result: { optimized_sequence: string } | null
  [key: string]: unknown
}

// Reads, or replaces then reads, the whole stored history.
function history(page: Page, write?: StoredEntry[]) {
  return page.evaluate(
    (entries) =>
      new Promise<StoredEntry[]>((resolve, reject) => {
        const open = indexedDB.open('rej-studio-job-history')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction(
            'keyval',
            entries ? 'readwrite' : 'readonly',
          )
          const store = tx.objectStore('keyval')
          const key = 'rej-studio:job-history'
          if (entries) store.put({ state: { entries }, version: 0 }, key)
          const get = store.get(key)
          tx.oncomplete = () => {
            db.close()
            const value = get.result as
              | { state: { entries: StoredEntry[] } }
              | undefined
            resolve(value?.state.entries ?? [])
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    write ?? null,
  )
}

test('warns before closing the tab while a design runs', async ({ page }) => {
  await page.goto(GENE_PAGE)
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)
  await page.getByRole('button', { name: /run designer/i }).click()
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeVisible()

  const dialog = page.waitForEvent('dialog')
  await page.close({ runBeforeUnload: true })
  const prompt = await dialog
  expect(prompt.type()).toBe('beforeunload')
  await prompt.dismiss()
})

test('a run cut off by a closed tab is offered again and redesigns identically', async ({
  page,
}) => {
  await page.goto(GENE_PAGE)
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)
  await page.getByRole('button', { name: /run designer/i }).click()
  await expect(page.getByText(/split after base/i).first()).toBeVisible({
    timeout: 120_000,
  })
  let finished: StoredEntry | undefined
  await expect
    .poll(async () => (finished = (await history(page))[0])?.status)
    .toBe('completed')

  // What a tab closed mid-run leaves behind: the same inputs, still running.
  await history(page, [
    { ...finished!, id: 'browser-e2e-orphan', status: 'running', result: null },
  ])
  await page.goto('/')

  await expect(page.getByText(/interrupted when its tab closed/i)).toBeVisible()
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(
    page.getByText(/tab closed before this design/i).first(),
  ).toBeVisible()

  await page
    .getByRole('button', { name: /run again/i })
    .first()
    .click()
  await expect(page.getByText(/split after base/i).first()).toBeVisible({
    timeout: 120_000,
  })
  let rerun: StoredEntry | undefined
  await expect
    .poll(async () => (rerun = (await history(page))[0])?.status)
    .toBe('completed')
  expect(rerun!.id).not.toBe('browser-e2e-orphan')
  expect(rerun!.result?.optimized_sequence).toBe(
    finished!.result?.optimized_sequence,
  )
})

// Protein input, end to end. The codon tables live in the Rust crate, so the
// DNA comes back from the optimizer worker — this is the only place that path
// runs for real.
test('reverse-translates a protein in the optimizer and designs it', async ({
  page,
}) => {
  await page.goto('/design-tool')

  await page.getByRole('radio', { name: 'Protein' }).click()
  await page.locator('input[name="name"]').fill('Protein input')

  // Arginine (R) is the residue the old TypeScript table disagreed with the
  // optimizer about; the crate's tables spell it AGA.
  const protein = 'MKRLDSEDDLERLKATLEGVDSVITD*'
  await page.locator('textarea').first().fill(protein)

  await expect(page.getByText(/bp DNA generated/i)).toBeVisible()
  await page
    .getByRole('button', { name: /reverse translate to continue/i })
    .click()

  // Back in DNA mode with the translated sequence, arginine spelled AGA.
  const sequence = page.locator('textarea').first()
  await expect(sequence).toHaveValue(/^ATGAAGAGA[ACGT]+$/)
  expect((await sequence.inputValue()).length).toBe(protein.length * 3)

  await page.getByRole('button', { name: /run designer/i }).click()
  await expect(page.getByText(/split after base/i).first()).toBeVisible({
    timeout: 120_000,
  })
})

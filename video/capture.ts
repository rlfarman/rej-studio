/**
 * Playwright capture script for the REJ Studio walkthrough video.
 *
 * Requires `pnpm dev` (or any server on VIDEO_BASE_URL) to be running.
 * Outputs PNG frames to ./frames and a timeline.json consumed by Remotion.
 *
 *   BYPASS_AUTH=true pnpm dev
 *   pnpm video:capture
 */
import { chromium, type Page, type Locator } from 'playwright'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRAMES_DIR = join(__dirname, 'public', 'frames')
const TIMELINE_PATH = join(__dirname, 'timeline.json')

const BASE_URL = process.env.VIDEO_BASE_URL ?? 'http://localhost:3000'
const WIDTH = 1920
const HEIGHT = 1080

type FocusRect = { x: number; y: number; width: number; height: number }
type Shot = {
  id: string
  file: string
  caption: string
  durationInSeconds: number
  focus?: FocusRect
}

const shots: Shot[] = []

async function focusOf(
  locator: Locator,
  page: Page,
): Promise<FocusRect | undefined> {
  const box = await locator.boundingBox()
  if (!box) return undefined
  const vp = page.viewportSize() ?? { width: WIDTH, height: HEIGHT }
  return {
    x: box.x / vp.width,
    y: box.y / vp.height,
    width: box.width / vp.width,
    height: box.height / vp.height,
  }
}

async function capture(
  page: Page,
  opts: {
    id: string
    caption: string
    durationInSeconds: number
    focus?: Locator
  },
) {
  const file = `${String(shots.length).padStart(3, '0')}-${opts.id}.png`
  const focus = opts.focus ? await focusOf(opts.focus, page) : undefined
  await page.screenshot({ path: join(FRAMES_DIR, file), fullPage: false })
  shots.push({
    id: opts.id,
    file,
    caption: opts.caption,
    durationInSeconds: opts.durationInSeconds,
    focus,
  })
  console.log(`  shot ${shots.length}: ${opts.id}`)
}

async function main() {
  rmSync(FRAMES_DIR, { recursive: true, force: true })
  mkdirSync(FRAMES_DIR, { recursive: true })

  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  })
  const page = await ctx.newPage()

  // --- 1. Gene search: MYO7A ---
  console.log('> Gene search')
  await page.goto(`${BASE_URL}/genes`, { waitUntil: 'domcontentloaded' })
  const search = page.getByPlaceholder(/Search by gene symbol/i).first()
  await search.click()
  await capture(page, {
    id: 'search-empty',
    caption: 'Search 20,000+ genes',
    durationInSeconds: 3,
    focus: search,
  })

  await search.pressSequentially('MYO7A', { delay: 90 })
  await page.waitForTimeout(2000)
  const firstResult = page
    .locator('[cmdk-item], [role="option"]')
    .filter({ hasText: 'MYO7A' })
    .first()
  await firstResult
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(async () => {
      await page.screenshot({ path: join(FRAMES_DIR, 'debug-no-results.png') })
      throw new Error('No MYO7A result appeared — see debug-no-results.png')
    })
  await capture(page, {
    id: 'search-results',
    caption: 'Typed "MYO7A"',
    durationInSeconds: 3,
    focus: firstResult,
  })

  // --- 2. Gene detail: pick the largest isoform ---
  console.log('> Gene detail')
  // Navigate directly — the command palette jumps straight to /design-tool,
  // but we want the isoform table first.
  await page.goto(`${BASE_URL}/genes/MYO7A`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  // Find the row whose CDS length cell has the max numeric value.
  // Fall back to the first row if the heuristic misses.
  const largestRow = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'))
    let best = { index: 0, len: 0 }
    rows.forEach((row, index) => {
      for (const td of Array.from(row.querySelectorAll('td'))) {
        const text = td.textContent ?? ''
        const m = text.match(/([\d,]+)\s*bp/i)
        if (m) {
          const len = parseInt(m[1].replace(/,/g, ''), 10)
          if (Number.isFinite(len) && len > best.len) best = { index, len }
          break
        }
      }
    })
    return best.index
  })

  const targetRow = page.locator('table tbody tr').nth(largestRow)
  await targetRow.scrollIntoViewIfNeeded()
  await capture(page, {
    id: 'isoform-table',
    caption: 'Pick the largest isoform',
    durationInSeconds: 4,
    focus: targetRow,
  })

  const customize = targetRow
    .locator('a[href*="/design-tool?isoform="]')
    .first()
  await capture(page, {
    id: 'isoform-customize',
    caption: 'Customize',
    durationInSeconds: 2,
    focus: customize,
  })

  // --- 3. Design tool form ---
  console.log('> Design tool')
  await Promise.all([
    page.waitForURL(/design-tool\?isoform=/, { timeout: 30000 }),
    customize.click(),
  ])
  await page
    .getByRole('button', { name: /run optimizer/i })
    .first()
    .waitFor({ state: 'visible', timeout: 45000 })
    .catch(() => undefined)
  await page.waitForTimeout(1200)
  await capture(page, {
    id: 'design-form',
    caption: 'Design tool',
    durationInSeconds: 5,
  })

  const submit = page.getByRole('button', { name: /run optimizer/i }).first()
  if (await submit.count()) {
    await capture(page, {
      id: 'design-submit',
      caption: 'Run optimizer',
      durationInSeconds: 3,
      focus: submit,
    })
    await submit.click().catch(() => undefined)

    // Wait for the optimizer to finish. Modal can take 30–120s for long sequences.
    await page
      .getByText(/optimizing your sequence/i)
      .waitFor({ state: 'hidden', timeout: 240_000 })
      .catch(() => undefined)
    await page.waitForTimeout(1500)

    const score = page.getByText(/^Score$/).first()
    await capture(page, {
      id: 'result-score',
      caption: 'Optimized',
      durationInSeconds: 5,
      focus: (await score.count()) ? score : undefined,
    })

    const objectives = page
      .getByRole('button', { name: /objectives report/i })
      .first()
    if (await objectives.count()) {
      await objectives.scrollIntoViewIfNeeded()
      await capture(page, {
        id: 'result-objectives',
        caption: 'Full diagnostics',
        durationInSeconds: 4,
        focus: objectives,
      })
    }
  }

  writeFileSync(
    TIMELINE_PATH,
    JSON.stringify({ width: WIDTH, height: HEIGHT, fps: 30, shots }, null, 2),
  )
  console.log(`\nWrote ${shots.length} shots to ${TIMELINE_PATH}`)

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

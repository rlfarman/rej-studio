import { expect, test, type Page } from '@playwright/test'

import { appCopy } from '../src/copy/app'
import { diseaseAssociationsCopy } from '../src/features/disease-associations/copy'
import { formatInheritanceLabel } from '../src/features/disease-associations/types'
import { geneSearchCopy } from '../src/features/gene-search/copy'
import { SAMPLE_GENE_COUNT } from '../src/features/gene-search/corpus/gene-data-url'
import { ACCOUNT_STATE_PATH } from './accounts'

// The pages, on the committed sample corpus (public/gene-data/sample), with
// no server behind them. Expected text comes from the copy files; otherwise
// assertions target roles and data.

/**
 * Fails the test on any request that isn't a static file or the app (the
 * account state aside: e2e/accounts.ts).
 */
function watchForServerCalls(page: Page) {
  const calls: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith('/api/') && pathname !== ACCOUNT_STATE_PATH) {
      calls.push(pathname)
    }
  })
  return calls
}

test('home renders the gene search', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('combobox').first()).toBeVisible()
})

test('/genes searches the corpus in the browser', async ({ page }) => {
  const serverCalls = watchForServerCalls(page)
  await page.goto('/genes')
  const box = page.getByRole('searchbox', {
    name: geneSearchCopy.searchPage.inputLabel,
  })
  await box.fill('brca')
  await box.press('Enter')

  await expect(page).toHaveURL(/\/genes\?q=brca$/)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: geneSearchCopy.searchPage.resultsTitle('brca'),
    }),
  ).toBeVisible()
  // Human and mouse BRCA1/BRCA2.
  const results = page.getByRole('region', {
    name: geneSearchCopy.searchPage.resultsTitle('brca'),
  })
  await expect(results.getByRole('listitem')).toHaveCount(4)

  // The species filter narrows the same query.
  await page
    .getByRole('navigation', { name: geneSearchCopy.searchPage.speciesLabel })
    .getByRole('link', { name: geneSearchCopy.command.speciesOptions.mouse })
    .click()
  await expect(page).toHaveURL(/species=mouse/)
  await expect(results.getByRole('listitem')).toHaveCount(2)

  // A result opens its gene page.
  await results.getByRole('link', { name: /BRCA1/ }).first().click()
  await expect(page).toHaveURL(/\/genes\/BRCA1\?species=mouse/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'BRCA1' }),
  ).toBeVisible()
  expect(serverCalls).toEqual([])
})

test('/genes forgives a typo in a symbol', async ({ page }) => {
  await page.goto('/genes?q=brac1')
  const results = page.getByRole('region', {
    name: geneSearchCopy.searchPage.resultsTitle('brac1'),
  })
  await expect(
    results.getByRole('link', { name: /BRCA1/ }).first(),
  ).toBeVisible()
})

test('/genes suggests other symbols when nothing matches', async ({ page }) => {
  // The sample corpus has EGFR for human only.
  await page.goto('/genes?q=EGFR&species=mouse')
  await expect(
    page.getByText(geneSearchCopy.results.noMatchesInSpecies('EGFR', 'Mouse')),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'EGFR' }).first()).toBeVisible()
})

test('a gene page lists its isoforms, with charts and phenotypes', async ({
  page,
}) => {
  const serverCalls = watchForServerCalls(page)
  const associationFiles: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    // Data only: under `vp dev` the feature's modules match too.
    if (request.resourceType() === 'fetch' && pathname.includes('associations'))
      associationFiles.push(pathname)
  })
  await page.goto('/genes/BRCA1?species=human')
  await expect(
    page.getByRole('heading', { level: 1, name: 'BRCA1' }),
  ).toBeVisible()
  await expect(page).toHaveTitle(appCopy.metadata.title('BRCA1'))

  // The isoform table, one row per isoform.
  await expect(page.locator('[id^="isoform-row-ENST"]').first()).toBeVisible()
  // The charts.
  await expect(
    page.getByRole('heading', {
      name: geneSearchCopy.identityMatrix.title,
    }),
  ).toBeVisible()
  // The identity matrix reads the alignment the corpus build stored: the
  // two longest BRCA1 isoforms are 98.8% identical.
  // Each cell is a button carrying that reading as its accessible name, so
  // the value is reachable by touch and keyboard, not only on hover.
  await expect(
    page.getByRole('button', {
      // Row before column: the matrix is ordered shortest-CDS-first to match
      // the length chart above it, so the shorter transcript is the row.
      name: geneSearchCopy.identityMatrix.cellLabel(
        '98.8',
        'ENST00000471181',
        'ENST00000357654',
      ),
    }),
  ).toBeAttached()
  // BRCA1 is disease-associated, so its OMIM phenotypes show.
  await expect(
    page.getByRole('heading', {
      name: diseaseAssociationsCopy.geneDetail.heading,
    }),
  ).toBeVisible()
  // From BRCA1's own small file, not the explorer's whole table.
  expect(associationFiles).toEqual([
    expect.stringMatching(/^\/assets\/disease-associations\/\w+\/br\.json$/),
  ])

  // A chart row opens that isoform in the table, without a page load.
  const firstRowLink = page.locator('a[href*="#isoform-row-"]').first()
  const isoform = (await firstRowLink.getAttribute('href'))!.match(
    /isoform-row-(ENST\d+)/,
  )![1]
  await firstRowLink.click()
  await expect(page).toHaveURL(new RegExp(`isoform=${isoform}`))
  await expect(page.locator(`#isoform-row-${isoform}`)).toBeInViewport()
  expect(serverCalls).toEqual([])
})

test('the TP53 gene page lists its isoforms', async ({ page }) => {
  await page.goto('/genes/TP53?species=human')
  await expect(page.getByRole('heading', { name: 'TP53' })).toBeVisible()
  await expect(page.getByText('ENST00000269305').first()).toBeVisible()
})

test('a symbol in another case redirects to the canonical one', async ({
  page,
}) => {
  await page.goto('/genes/tp53?species=human')
  await expect(page).toHaveURL('/genes/TP53?species=human')
  await expect(page.getByRole('heading', { name: 'TP53' })).toBeVisible()
})

test('an unknown gene shows not-found, with suggestions', async ({ page }) => {
  await page.goto('/genes/BRCA9')
  await expect(
    page.getByRole('heading', {
      name: appCopy.geneNotFound.title('BRCA9'),
    }),
  ).toBeVisible()
  // In the page slot, with the shell around it.
  await expect(page.locator('main#main-content h1')).toHaveCount(1)
  await expect(page.getByText(appCopy.geneNotFound.didYouMean)).toBeVisible()
  await page.getByRole('link', { name: 'BRCA1' }).first().click()
  await expect(page).toHaveURL(/\/genes\/BRCA1\?species=/)
})

test('the design tool prefills the coding sequence from an isoform', async ({
  page,
}) => {
  await page.goto('/design-tool?isoform=ENST00000269305')
  await expect(page.locator('textarea').first()).toHaveValue(/^ATG[ACGT]+$/i)
  // The transcript is part of the name: three isoforms of one gene would
  // otherwise all open as the same run.
  await expect(page.locator('input[name="name"]')).toHaveValue(
    'TP53 ENST00000269305',
  )
})

test('the disease-associations filters narrow and sort the table', async ({
  page,
}) => {
  const copy = diseaseAssociationsCopy
  await page.goto('/disease-associations')
  const summary = page.getByText(/^\d+ genes$/)
  await expect(summary).toBeVisible()
  const total = Number((await summary.textContent())!.split(' ')[0])

  // The text filter is debounced into the URL.
  await page
    .getByRole('searchbox', { name: copy.filters.searchAria })
    .fill('BRCA')
  await expect(page).toHaveURL(/q=BRCA/)
  await expect(
    page.getByText(new RegExp(`^\\d+ of ${total} genes$`)),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: copy.table.viewGeneAria('BRCA1') }),
  ).toBeVisible()

  // An inheritance chip toggles.
  const chip = page.getByRole('button', {
    name: new RegExp(`^${formatInheritanceLabel('Autosomal dominant')}`),
  })
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/i=/)

  // Sorting by largest CDS, then the gene link opens the gene page.
  await page.getByRole('link', { name: copy.table.columns.largestCds }).click()
  await expect(page).toHaveURL(/sort=cds/)
  await page
    .getByRole('link', { name: copy.table.viewGeneAria('BRCA1') })
    .click()
  await expect(page).toHaveURL('/genes/BRCA1?species=human')

  // Back keeps the filters; Clear drops them.
  await page.goBack()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: copy.filters.clearAll }).click()
  await expect(page).toHaveURL('/disease-associations')
  await expect(page.getByText(`${total} genes`, { exact: true })).toBeVisible()
})

test('disease-association pages navigate without a reload', async ({
  page,
}) => {
  await page.goto('/disease-associations')
  await page.evaluate(() => {
    ;(window as unknown as { marker: number }).marker = 1
  })
  // The numbered links are anchors the button primitive gives role=button.
  await page
    .getByRole('navigation', {
      name: diseaseAssociationsCopy.table.paginationAria,
    })
    .getByRole('button', { name: '2', exact: true })
    .click()
  await expect(page).toHaveURL('/disease-associations?page=2')
  await expect(page.getByText(/^51–100 of/)).toBeVisible()
  expect(
    await page.evaluate(
      () => (window as unknown as { marker?: number }).marker,
    ),
  ).toBe(1)
})

test('search URLs stay plain query strings', async ({ page }) => {
  await page.goto('/genes')
  const box = page.getByRole('searchbox', {
    name: geneSearchCopy.searchPage.inputLabel,
  })
  await box.fill('53')
  await box.press('Enter')
  await expect(page).toHaveURL(/\/genes\?q=53$/)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: geneSearchCopy.searchPage.resultsTitle('53'),
    }),
  ).toBeVisible()

  // Repeated keys for a list, and a single value from an older link.
  await page.goto('/disease-associations?i=X-linked')
  const xLinked = page.getByRole('button', {
    name: new RegExp(`^${formatInheritanceLabel('X-linked')}`),
  })
  await expect(xLinked).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByRole('button', {
      name: new RegExp(`^${formatInheritanceLabel('Digenic')}`),
    })
    .click()
  await expect(page).toHaveURL('/disease-associations?i=X-linked&i=Digenic')

  // A JSON-encoded link copied while the router wrote JSON values.
  await page.goto('/genes?q=%2253%22')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: geneSearchCopy.searchPage.resultsTitle('53'),
    }),
  ).toBeVisible()
})

test('a build on the sample corpus says so', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByText(appCopy.sampleData.label(SAMPLE_GENE_COUNT)),
  ).toBeVisible()
})

test('highlighting a palette result preloads its gene page', async ({
  page,
}) => {
  // Palette rows open with navigate(), so the router's hover preloading
  // doesn't apply; the palette preloads the highlighted gene itself.
  // Prerendered: the button is on screen before the page hydrates, and a
  // click before then does nothing. Wait for the app to be live.
  await page.goto('/design-tool', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: geneSearchCopy.trigger.label }).click()
  await page.getByRole('dialog').getByRole('combobox').fill('tp53')
  const geneFile = page.waitForRequest((request) =>
    new URL(request.url()).pathname.endsWith('/genes/ENSG00000141510.json'),
  )
  await page.getByRole('option', { name: /TP53/ }).first().hover()
  await geneFile
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/genes\/TP53/)
})

test('the palette works from the keyboard', async ({ page }) => {
  await page.goto('/design-tool', { waitUntil: 'networkidle' })
  const trigger = page.getByRole('button', {
    name: geneSearchCopy.trigger.label,
  })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  const input = dialog.getByRole('combobox', {
    name: geneSearchCopy.command.inputAria,
  })
  await expect(input).toBeFocused()

  // Escape closes the dialog and hands focus back to the button.
  await input.fill('brca1')
  await expect(dialog.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  // The first result starts highlighted; ArrowDown moves to the next, and
  // Enter opens it.
  await trigger.click()
  await expect(input).toBeFocused()
  await input.fill('brca1')
  const options = dialog.getByRole('option', { name: /BRCA1/ })
  await expect(options).toHaveCount(2)
  const second = await options.nth(1).getAttribute('id')
  await page.keyboard.press('ArrowDown')
  await expect(input).toHaveAttribute('aria-activedescendant', second!)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/genes\/BRCA1\?species=mouse/)
  await expect(dialog).toBeHidden()
})

test('the home page search opens a gene from the keyboard', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const input = page.getByRole('combobox', {
    name: geneSearchCopy.command.inputAria,
  })
  await input.fill('tp53')
  await expect(page.getByRole('option', { name: /TP53/ }).first()).toBeVisible()
  await input.press('ArrowDown')
  await input.press('ArrowUp')
  await input.press('Enter')
  await expect(page).toHaveURL(/\/genes\/TP53/)
})

test('a term hint opens on click, closes on Escape, and leaves the table alone', async ({
  page,
}) => {
  // An infotip is a popover, not a tooltip, so a tap (a click here) opens it
  // on touch devices too.
  await page.goto('/genes/TP53', { waitUntil: 'networkidle' })
  const { gc } = geneSearchCopy.terms
  const hint = page.getByRole('button', {
    name: geneSearchCopy.terms.termAria(gc.label),
  })
  await hint.first().click()
  await expect(page.getByText(gc.hint)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText(gc.hint)).toBeHidden()
})

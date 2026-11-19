import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { commonCopy } from '@/copy/common'
import { resetChartTablePreferencesForTests } from '@/components/chart-data-table'
import { geneSearchCopy } from '../copy'
import { parseIsoformIdentity } from '../corpus/identity'
import type { IsoformListItem } from '../types/domain-types'
import { IsoformIdentityMatrix } from './isoform-identity-matrix'

const downloads: [string, string][] = []
vi.mock('@/lib/download-file', () => ({
  downloadTextFile: (name: string, text: string) => {
    downloads.push([name, text])
  },
}))

const copy = geneSearchCopy.identityMatrix
const commonChart = commonCopy.chartData

afterEach(() => {
  downloads.length = 0
  cleanup()
  window.sessionStorage.clear()
  resetChartTablePreferencesForTests()
})

const isoform = (id: string, length: number): IsoformListItem => ({
  id,
  codingSequenceLength: length * 3,
  proteinSequenceLength: length,
  codingSequence: '',
  proteinSequence: '',
  species: 'human',
})

// Stored order is longest protein first (ENST2, ENST3, ENST1); the grid
// draws them shortest CDS first, matching the length chart: ENST1, ENST3,
// ENST2.
const isoforms = [
  isoform('ENST1', 50),
  isoform('ENST2', 300),
  isoform('ENST3', 100),
]
const identity = parseIsoformIdentity(
  { isoforms: ['ENST2', 'ENST3', 'ENST1'], permille: [642, 125, 1000] },
  isoforms,
)

// The row headers link within the gene page, so it renders under that route.
function renderOnGenePage(ui: ReactNode) {
  const rootRoute = createRootRoute({ component: Outlet })
  const geneRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/genes/$symbol',
    component: () => ui,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([geneRoute]),
    history: createMemoryHistory({ initialEntries: ['/genes/TP53'] }),
  })
  render(<RouterProvider router={router} />)
}

describe('IsoformIdentityMatrix', () => {
  // The length chart above draws its bars shortest CDS first, and its row
  // numbers are these row numbers; ordering the grid the other way (by
  // protein length, as the stored data is) mapped row 1 here onto the last
  // bar there.
  it('shows the stored identities in the length chart’s order', async () => {
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={isoforms} identity={identity} />,
    )
    const table = await screen.findByRole('table', { name: copy.caption })
    const rows = within(table).getAllByRole('row').slice(1)
    // A lower triangle: rows are isoforms 2..n and columns 1..n-1, so no
    // row and no column is drawn empty.
    expect(
      rows.map((row) => within(row).getByRole('link').getAttribute('title')),
    ).toEqual(['ENST3', 'ENST2'].map(copy.jumpTo))
    // Column headers link like row labels, so isoform 1, which has no row,
    // can still be reached from the grid.
    const columnLinks = within(table)
      .getAllByRole('columnheader')
      .slice(1)
      .map((th) => within(th).getByRole('link', { name: /ENST/ }))
    expect(columnLinks.map((link) => link.getAttribute('title'))).toEqual(
      ['ENST1', 'ENST3'].map(copy.jumpTo),
    )
    expect(columnLinks[0].getAttribute('href')).toBe(
      '/genes/TP53?isoform=ENST1#isoform-row-ENST1',
    )
    for (const row of rows) {
      expect(within(row).queryAllByRole('button').length).toBeGreaterThan(0)
    }
    // The same pairs, read out of the permuted matrix.
    expect(
      screen.getByLabelText(copy.cellLabel('64.2', 'ENST2', 'ENST3')),
    ).toBeTruthy()
    expect(
      screen.getByLabelText(copy.cellLabel('12.5', 'ENST2', 'ENST1')),
    ).toBeTruthy()
    expect(
      screen.getByLabelText(copy.cellLabel('100.0', 'ENST3', 'ENST1')),
    ).toBeTruthy()
    expect(screen.getByText(copy.footnote)).toBeTruthy()
    expect(screen.queryByText(copy.unavailable)).toBeNull()
  })

  it('reads a value out without a pointer', async () => {
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={isoforms} identity={identity} />,
    )
    // Nothing chosen yet: an invitation, not a value.
    expect(await screen.findByText(copy.cellHint)).toBeTruthy()

    // Tapping a cell — the whole interaction a phone has — says what it is.
    const cell = screen.getByLabelText(copy.cellLabel('12.5', 'ENST2', 'ENST1'))
    fireEvent.click(cell)
    expect(
      screen.getByText(copy.cellReadout('12.5', 'ENST2', 'ENST1')),
    ).toBeTruthy()
    expect(screen.queryByText(copy.cellHint)).toBeNull()
  })

  it('is one tab stop, walked with the arrow keys', async () => {
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={isoforms} identity={identity} />,
    )
    const table = await screen.findByRole('table', { name: copy.caption })
    const cells = within(table).getAllByRole('button')
    // Every drawn cell is reachable, but only one is in the tab order.
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1)

    // The first cell is isoform 2 against isoform 1, the grid's first row.
    expect(cells[0].getAttribute('aria-label')).toBe(
      copy.cellLabel('100.0', 'ENST3', 'ENST1'),
    )

    cells[0].focus()
    fireEvent.keyDown(cells[0], { key: 'ArrowDown' })
    // Row 3, column 1: ENST2 against ENST1.
    expect(
      screen.getByText(copy.cellReadout('12.5', 'ENST2', 'ENST1')),
    ).toBeTruthy()
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      copy.cellLabel('12.5', 'ENST2', 'ENST1'),
    )

    // And it cannot be walked onto the diagonal: End stops one short of the
    // row's own column.
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      copy.cellLabel('64.2', 'ENST2', 'ENST3'),
    )
  })

  // A 100% cell against itself, in the ramp's top color — the one that means
  // "near-duplicate, worth acting on" — drew a dark staircase through the
  // chart and read out a meaningless 100% in every row.
  it('draws no diagonal, matching the data table', async () => {
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={isoforms} identity={identity} />,
    )
    const table = await screen.findByRole('table', { name: copy.caption })
    const cells = within(table).getAllByRole('button')

    // Three isoforms: three pairs, of which the lower triangle draws three
    // minus the diagonal.
    expect(cells).toHaveLength(3)
    for (const id of ['ENST1', 'ENST2', 'ENST3']) {
      expect(
        screen.queryByLabelText(copy.cellLabel('100.0', id, id)),
      ).toBeNull()
    }
  })

  it('names the CSV after the gene and puts the gene in it', async () => {
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={isoforms} identity={identity} />,
    )
    fireEvent.click(
      await screen.findByRole('button', { name: commonChart.show }),
    )
    const tables = screen.getAllByRole('table')
    const dataTable = tables.find((table) =>
      table.querySelector('caption')?.textContent?.includes('global alignment'),
    )!
    expect(
      [...dataTable.querySelectorAll('thead th')].map((th) => th.textContent),
    ).toEqual([...geneSearchCopy.charts.identityMatrix.columns])
    expect(within(dataTable).getAllByText('TP53').length).toBeGreaterThan(0)

    fireEvent.click(
      screen.getByRole('button', {
        name: commonChart.downloadAria(
          geneSearchCopy.charts.identityMatrix.caption,
        ),
      }),
    )
    expect(downloads.at(-1)?.[0]).toBe('TP53_isoform-identity.csv')
    expect(downloads.at(-1)?.[1]).toContain('TP53,ENST3,ENST2')
  })

  // A grid of three cells, two of them an isoform against itself, under a
  // five-bin scale, with its one number behind a hover.
  it('states the one pair in words for a two-isoform gene', async () => {
    const pair = [isoform('ENST1', 50), isoform('ENST2', 300)]
    const pairIdentity = parseIsoformIdentity(
      { isoforms: ['ENST2', 'ENST1'], permille: [877] },
      pair,
    )
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={pair} identity={pairIdentity} />,
    )

    expect(
      await screen.findByText(copy.pairSummary('ENST1', 'ENST2', '87.7')),
    ).toBeTruthy()
    // No grid, and no scale for a scale with one point on it.
    expect(screen.queryByRole('table', { name: copy.caption })).toBeNull()
    expect(screen.queryByRole('list', { name: copy.legendAria })).toBeNull()
    // The numbers and the method still are there.
    expect(screen.getByText(copy.footnote)).toBeTruthy()
    expect(screen.getByRole('button', { name: commonChart.show })).toBeTruthy()
  })

  // The footnote asks the reader to optimize one isoform per ≥95% cluster;
  // in gene order those pairs were scattered through 120 unsortable rows.
  it('lists the most identical pairs first', async () => {
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={isoforms} identity={identity} />,
    )
    fireEvent.click(
      await screen.findByRole('button', { name: commonChart.show }),
    )
    const dataTable = screen
      .getAllByRole('table')
      .find((table) =>
        table
          .querySelector('caption')
          ?.textContent?.includes('global alignment'),
      )!

    expect(
      [...dataTable.querySelectorAll('tbody tr')].map(
        (row) => row.querySelectorAll('td')[3]?.textContent,
      ),
    ).toEqual(['100.0', '64.2', '12.5'])
  })

  it('says identities are unavailable rather than estimating them', async () => {
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={isoforms} identity={null} />,
    )
    expect(await screen.findByText(copy.unavailable)).toBeTruthy()
    expect(screen.getByRole('heading', { name: copy.title })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders nothing for a gene with one isoform', async () => {
    renderOnGenePage(
      <div data-testid="page">
        <IsoformIdentityMatrix
          isoforms={[isoform('ENST1', 10)]}
          identity={null}
        />
      </div>,
    )
    expect((await screen.findByTestId('page')).childElementCount).toBe(0)
  })

  it('says when only the longest isoforms are shown', async () => {
    const many = Array.from({ length: 18 }, (_, i) =>
      isoform(`ENST${String(i).padStart(2, '0')}`, 100 + i),
    )
    const shownIds = [...many]
      .reverse()
      .slice(0, 16)
      .map(({ id }) => id)
    const stored = parseIsoformIdentity(
      { isoforms: shownIds, permille: Array.from({ length: 120 }, () => 900) },
      many,
    )
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={many} identity={stored} />,
    )
    expect(
      await screen.findByText(copy.truncated(16, 18), { exact: false }),
    ).toBeTruthy()
  })
})

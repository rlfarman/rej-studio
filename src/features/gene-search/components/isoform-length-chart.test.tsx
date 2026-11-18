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
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { resetChartTablePreferencesForTests } from '@/components/chart-data-table'
import { commonCopy } from '@/copy/common'
import { getSuitabilityConfig } from '@/lib/bio/design-suitability'
import { geneSearchCopy } from '../copy'
import type { IsoformListItem } from '../types/domain-types'
import { IsoformLengthChart } from './isoform-length-chart'

const downloads: [string, string][] = []
vi.mock('@/lib/download-file', () => ({
  downloadTextFile: (name: string, text: string) => {
    downloads.push([name, text])
  },
}))

const chartCopy = geneSearchCopy.charts.isoformLengths
const commonChart = commonCopy.chartData

afterEach(() => {
  downloads.length = 0
  cleanup()
  window.sessionStorage.clear()
  resetChartTablePreferencesForTests()
})

const isoform = (id: string, cdsLength: number): IsoformListItem => ({
  id,
  codingSequence: 'A'.repeat(cdsLength),
  codingSequenceLength: cdsLength,
  proteinSequence: '',
  proteinSequenceLength: Math.floor(cdsLength / 3),
  species: 'human',
})

// A span of tiers, or the chart hides itself (see lengthChartModel).
const isoforms = [
  isoform('ENST3', 9_000),
  isoform('ENST1', 1_200),
  isoform('ENST2', 5_000),
]

function renderChart() {
  const rootRoute = createRootRoute({ component: Outlet })
  const geneRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/genes/$symbol',
    component: () => <IsoformLengthChart isoforms={isoforms} />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([geneRoute]),
    history: createMemoryHistory({ initialEntries: ['/genes/TP53'] }),
  })
  return render(<RouterProvider router={router} />)
}

async function openDataTable() {
  fireEvent.click(await screen.findByRole('button', { name: commonChart.show }))
  return screen.getByRole('table')
}

describe('the isoform length chart’s numbers', () => {
  it('names the tiers the way the legend does, not by their slugs', async () => {
    renderChart()
    const cells = [...(await openDataTable()).querySelectorAll('tbody td')].map(
      (cell) => cell.textContent,
    )

    expect(cells).toContain(getSuitabilityConfig('single-aav').label)
    expect(cells).toContain(getSuitabilityConfig('dual-aav').label)
    expect(cells).toContain(getSuitabilityConfig('triple-aav').label)
    // The slug never reaches the reader.
    expect(cells).not.toContain('single-aav')
  })

  it('carries the gene in the table and in the CSV’s name', async () => {
    renderChart()
    const table = await openDataTable()

    expect(
      [...table.querySelectorAll('thead th')].map((th) => th.textContent),
    ).toEqual([...chartCopy.columns])
    expect(within(table).getAllByText('TP53')).toHaveLength(isoforms.length)

    fireEvent.click(
      screen.getByRole('button', {
        name: commonChart.downloadAria(chartCopy.caption),
      }),
    )
    expect(downloads.at(-1)?.[0]).toBe('TP53_isoform-lengths.csv')
    expect(downloads.at(-1)?.[1]).toContain('TP53,ENST1,1200,Single AAV')
  })

  it('lists the isoforms shortest first, as the identity matrix does', async () => {
    renderChart()
    const rows = [...(await openDataTable()).querySelectorAll('tbody tr')].map(
      (row) => row.querySelectorAll('td')[1]?.textContent,
    )

    expect(rows).toEqual(['ENST1', 'ENST2', 'ENST3'])
  })
})

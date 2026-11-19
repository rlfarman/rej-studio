import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'

import {
  ChartDataTable,
  resetChartTablePreferencesForTests,
} from './chart-data-table'

afterEach(() => {
  // Restore before cleanup: the CSV test spies on document.createElement,
  // which cleanup itself uses.
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  cleanup()
  window.sessionStorage.clear()
  resetChartTablePreferencesForTests()
})

const COLUMNS = ['Position (bp)', 'Original GC %', 'Optimized GC %']
const ROWS = [
  [0, 48.3, 52.1],
  [30, 51.7, 49.9],
]

const table = (props: Partial<Parameters<typeof ChartDataTable>[0]> = {}) =>
  render(
    <ChartDataTable
      caption="GC content along the sequence"
      columns={COLUMNS}
      rows={ROWS}
      storageKey="test"
      {...props}
    />,
  )

describe('the numbers behind a chart', () => {
  it('stays out of the way until it is asked for', () => {
    table()

    expect(screen.queryByRole('table')).toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'View as table' })
        .getAttribute('aria-expanded'),
    ).toBe('false')
  })

  it('shows the same values the chart was drawn from', () => {
    table()
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    // A header row and one per data point.
    expect(rows).toHaveLength(3)
    expect(within(rows[1] as HTMLElement).getByText('48.3')).toBeTruthy()
    expect(within(rows[2] as HTMLElement).getByText('49.9')).toBeTruthy()
  })

  it('names itself, so it reads on its own without the chart', () => {
    table()
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))

    expect(screen.getByText('GC content along the sequence')).toBeTruthy()
    for (const column of COLUMNS) {
      expect(screen.getByRole('columnheader', { name: column })).toBeTruthy()
    }
  })

  it('closes again', () => {
    table()
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide table' }))

    expect(screen.queryByRole('table')).toBeNull()
  })

  it('remembers the choice for the session, so it is asked for once', () => {
    const first = table()
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))
    first.unmount()

    table()
    expect(screen.getByRole('table')).toBeTruthy()
  })

  it('keeps that choice per kind of chart, not per chart', () => {
    table({ storageKey: 'sequence' })
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))
    cleanup()

    table({ storageKey: 'isoforms' })
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('can still be opened when storage is blocked, as in a private window', () => {
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    table({ storageKey: 'blocked' })
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))

    // The reader asked for the numbers; a blocked preference must not withhold them.
    expect(screen.getByRole('table')).toBeTruthy()
  })

  it('can still be opened when storage reads but refuses to write', () => {
    // Safari at its quota, and private modes generally: getItem answers, and
    // setItem throws. The preference used to go to a map that nothing read,
    // so the button clicked and the table never appeared.
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    table({ storageKey: 'unwritable' })
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))

    expect(screen.getByRole('table')).toBeTruthy()

    // And it still closes again, rather than latching open.
    fireEvent.click(screen.getByRole('button', { name: 'Hide table' }))
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('offers the rows as a CSV when one is wanted', () => {
    // Stub only the blob URL: spying on document.createElement would also
    // catch React's own rendering.
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:x')
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })

    table({ csvFilename: 'gc.csv', storageKey: 'csv' })
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))
    fireEvent.click(screen.getByRole('button', { name: /Download .* as CSV/ }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(createObjectURL.mock.calls[0]?.[0]?.type).toBe('text/plain')
  })

  it('prints a formatted column the same on screen and in the CSV', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:x')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })

    table({
      rows: [
        [0, 100, 52.1],
        [30, 98.8, 49.9],
      ],
      columnFormat: [undefined, (cell) => Number(cell).toFixed(1)],
      csvFilename: 'gc.csv',
      storageKey: 'format',
    })
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))

    const cells = within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1]?.textContent)
    expect(cells).toEqual(['100.0', '98.8'])

    fireEvent.click(screen.getByRole('button', { name: /Download .* as CSV/ }))
    const csv = await createObjectURL.mock.calls[0]?.[0]?.text()
    expect(csv?.split('\n').slice(1)).toEqual(['0,100.0,52.1', '30,98.8,49.9'])
  })

  it('offers no download when none was asked for', () => {
    table()
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))

    expect(screen.queryByRole('button', { name: /CSV/ })).toBeNull()
  })

  it('shows nothing at all when the chart has no data', () => {
    const { container } = table({ rows: [] })

    expect(container.innerHTML).toBe('')
  })
})

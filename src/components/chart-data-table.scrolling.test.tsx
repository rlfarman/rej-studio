import { afterEach, describe, expect, it } from 'vite-plus/test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import {
  ChartDataTable,
  resetChartTablePreferencesForTests,
} from './chart-data-table'
import { Table, TableBody, TableCell, TableRow } from './ui/table'

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  resetChartTablePreferencesForTests()
})

/**
 * The classes that make an element scroll, as Tailwind spells them.
 *
 * jsdom applies no stylesheet, so there is nothing to compute `overflow`
 * from and nothing to measure; what these tests can hold is the structure —
 * which element is asked to scroll, and that only one is. That is exactly
 * what both bugs were: a second scroller in the way of the first.
 */
const SCROLLS = /^overflow(-[xy])?-(auto|scroll|hidden)$/

function scrollersFrom(start: Element, stop: Element): Element[] {
  const found: Element[] = []
  for (
    let el: Element | null = start;
    el && el !== stop;
    el = el.parentElement
  ) {
    if ([...el.classList].some((name) => SCROLLS.test(name))) found.push(el)
  }
  return found
}

const open = () =>
  fireEvent.click(screen.getByRole('button', { name: 'View as table' }))

describe('a chart data table scrolls where its header is pinned', () => {
  it('puts the height and the scrolling on the table container itself', () => {
    const { container } = render(
      <ChartDataTable
        caption="Pairwise identity"
        columns={['Isoform A', 'Isoform B', 'Identity (%)']}
        rows={[['ENST1', 'ENST2', 64.2]]}
        storageKey="test"
      />,
    )
    open()

    const table = screen.getByRole('table')
    const scrollers = scrollersFrom(table, container)

    // One scroller, and it is the table's own container — so the sticky
    // header, which pins to the nearest scroll container, pins to the
    // element the rows actually scroll in.
    expect(scrollers).toHaveLength(1)
    expect(scrollers[0]).toBe(table.parentElement)
    expect(scrollers[0].getAttribute('data-slot')).toBe('table-container')
    expect(scrollers[0].className).toContain('max-h-80')
  })

  it('gives the pinned header an opaque background', () => {
    render(
      <ChartDataTable
        caption="Pairwise identity"
        columns={['Isoform A', 'Identity (%)']}
        rows={[['ENST1', 64.2]]}
        storageKey="test"
      />,
    )
    open()

    const header = screen.getByRole('table').querySelector('thead')
    expect(header).not.toBeNull()
    const classes = header!.className
    expect(classes).toContain('sticky')
    // A translucent header lets the rows it is pinned over read through it,
    // which is worse than no header at all.
    expect(classes).not.toMatch(/bg-[a-z-]+\/\d+/)
    expect(classes).toContain('bg-muted')
  })
})

describe('Table', () => {
  it('styles its scroll container without losing the default scrolling', () => {
    const { container } = render(
      <Table containerClassName="max-h-40 overflow-auto rounded-xl border">
        <TableBody>
          <TableRow>
            <TableCell>1</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    const wrapper = container.querySelector('[data-slot="table-container"]')!
    // `cn` merges the conflict: a caller asking for both axes gets both,
    // not the default's x-only on top of it.
    expect(wrapper.className).toContain('overflow-auto')
    expect(wrapper.className).not.toContain('overflow-x-auto')
    expect(wrapper.className).toContain('max-h-40')
    expect(wrapper.className).toContain('rounded-xl')
  })

  it('still renders a bare scroll container when nothing styles it', () => {
    const { container } = render(
      <Table className="given">
        <TableBody>
          <TableRow>
            <TableCell>1</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    const wrapper = container.querySelector('[data-slot="table-container"]')!
    expect(wrapper.className).toBe('relative w-full overflow-x-auto')
    expect(container.querySelector('table')!.className).toContain('given')
  })
})

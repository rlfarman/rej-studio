import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { geneSearchCopy } from '../copy'
import type { IsoformListItem } from '../types/domain-types'
import IsoformTable from './isoform-table'

const copy = geneSearchCopy.isoformTable
const splitCopy = geneSearchCopy.splitPreview

// A WGGW-bearing, in-frame-ish filler so the split preview has candidates.
function cds(length: number) {
  return 'ATGAGGTCCA'.repeat(Math.ceil(length / 10)).slice(0, length)
}

function isoform(id: string, cdsLength: number): IsoformListItem {
  return {
    id,
    codingSequence: cds(cdsLength),
    codingSequenceLength: cdsLength,
    proteinSequence: 'M'.repeat(Math.floor(cdsLength / 3)),
    proteinSequenceLength: Math.floor(cdsLength / 3),
    species: 'human',
  }
}

// assessDesignSuitability: < 4,000 single, < 8,000 dual, else triple.
const dual = isoform('ENST00000000001', 5_000)
const triple = isoform('ENST00000356175', 9_000)

function zipUrl(id: string) {
  return `https://rej-seq-1.s3.us-west-004.backblazeb2.com/rej/v1.0/zips/${id}_v1.0.zip`
}

function renderTable(props: {
  isoforms: IsoformListItem[]
  highlightedIsoformId?: string
}) {
  const rootRoute = createRootRoute({ component: Outlet })
  const geneRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/genes/$symbol',
    component: () => <IsoformTable {...props} />,
  })
  const designRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/design-tool',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([geneRoute, designRoute]),
    history: createMemoryHistory({ initialEntries: ['/genes/NF1'] }),
  })
  return render(<RouterProvider router={router} />)
}

/** Lets the router finish its first render (and React flush effects). */
async function flush() {
  await act(async () => {})
}

/** Base UI menus open on pointer down, not on a bare click. */
function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.mouseDown(trigger, { button: 0 })
  fireEvent.pointerUp(trigger)
  fireEvent.mouseUp(trigger)
  fireEvent.click(trigger)
}

function rowEl(id: string) {
  const row = document.getElementById(`isoform-row-${id}`)
  if (!row) throw new Error(`no row for ${id}`)
  return row
}

function zipLinks() {
  return [
    ...document.querySelectorAll<HTMLAnchorElement>('a[href*="/zips/"]'),
  ].map((a) => a.getAttribute('href'))
}

beforeEach(() => {
  // The hover quick actions only mount on a fine pointer at >= 40rem.
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('IsoformTable pre-optimized ZIP', () => {
  it('offers the ready-made ZIP for a dual-AAV isoform', async () => {
    renderTable({ isoforms: [dual] })

    // Quick action.
    expect(
      await screen.findByLabelText(copy.downloadAria(dual.id)),
    ).toBeTruthy()
    expect(zipLinks()).toContain(zipUrl(dual.id))

    // Row menu.
    openMenu(screen.getByLabelText(copy.moreAria(dual.id)))
    expect(await screen.findByText(copy.downloadLong)).toBeTruthy()
    expect(screen.queryByText(copy.downloadUnavailable)).toBeNull()
  })

  it('offers no ZIP download anywhere for a triple-AAV isoform', async () => {
    renderTable({ isoforms: [triple] })

    await screen.findByText(triple.id)
    // Quick action.
    expect(screen.queryByLabelText(copy.downloadAria(triple.id))).toBeNull()

    // Expanded row.
    fireEvent.click(screen.getByLabelText(copy.expandRowAria(triple.id)))
    expect(screen.getByText(copy.downloadUnavailable)).toBeTruthy()
    expect(screen.getByText(copy.downloadUnavailableReason)).toBeTruthy()
    expect(screen.queryByText(copy.downloadLong)).toBeNull()

    // Row menu.
    openMenu(screen.getByLabelText(copy.moreAria(triple.id)))
    // Two of each now: the expanded row's and the open menu's.
    expect(await screen.findAllByText(copy.customizeLong)).toHaveLength(2)
    expect(screen.getAllByText(copy.downloadUnavailable)).toHaveLength(2)
    expect(screen.queryByText(copy.downloadLong)).toBeNull()

    // Nothing in the DOM links to a package for this isoform.
    expect(zipLinks()).toEqual([])
  })

  it('does not call a two-way split best for a triple-AAV isoform', async () => {
    renderTable({ isoforms: [dual, triple] })
    await flush()

    fireEvent.click(screen.getByLabelText(copy.expandRowAria(dual.id)))
    expect(screen.getByText(splitCopy.bestSplit)).toBeTruthy()

    fireEvent.click(screen.getByLabelText(copy.expandRowAria(triple.id)))
    // Still only the dual row's preview.
    expect(screen.getAllByText(splitCopy.bestSplit)).toHaveLength(1)
  })
})

describe('IsoformTable arrival highlight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Runs the scroll-settling animation frames. */
  async function runFrames() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
  }

  it('scrolls the linked row into view with a scroll the router cannot cancel', async () => {
    const scrollIntoView = vi.fn()
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(
      scrollIntoView,
    )

    renderTable({ isoforms: [dual], highlightedIsoformId: dual.id })
    await flush()
    await runFrames()

    expect(scrollIntoView).toHaveBeenCalled()
    for (const call of scrollIntoView.mock.calls) {
      expect(call[0]).toEqual({ behavior: 'instant', block: 'center' })
    }
    // Re-asserted across frames, so the router's later scroll restoration
    // doesn't leave the row below the fold.
    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(1)
  })

  it('stops re-asserting the scroll once the reader scrolls', async () => {
    const scrollIntoView = vi.fn()
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(
      scrollIntoView,
    )

    renderTable({ isoforms: [dual], highlightedIsoformId: dual.id })
    await flush()
    fireEvent.wheel(window)
    await runFrames()

    // Only the frame that ran before the wheel event, if any.
    expect(scrollIntoView.mock.calls.length).toBeLessThan(2)
    // The arrival is still announced.
    expect(rowEl(dual.id).className).toContain('ring-2')
  })

  it('holds the highlight ring until the row is in view', async () => {
    const inView = { top: 0, bottom: 0 }
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ ...inView, left: 0, right: 0, width: 0, height: 0 }) as DOMRect,
    )

    renderTable({ isoforms: [dual], highlightedIsoformId: dual.id })
    await flush()

    const row = rowEl(dual.id)
    expect(row.className).not.toContain('ring-2')

    // The scroller finally lands on the row.
    inView.top = 100
    inView.bottom = 140
    await runFrames()
    expect(rowEl(dual.id).className).toContain('ring-2')

    // And the ring expires only after it has been seen.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100)
    })
    expect(rowEl(dual.id).className).not.toContain('ring-2')
  })
})

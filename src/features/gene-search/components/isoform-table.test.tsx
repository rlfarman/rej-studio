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

import { commonCopy } from '@/copy/common'
import { geneSearchCopy } from '../copy'
import type { IsoformListItem } from '../types/domain-types'
import IsoformTable from './isoform-table'

const downloads: [string, string][] = []
vi.mock('@/lib/download-file', () => ({
  downloadTextFile: (name: string, text: string) => {
    downloads.push([name, text])
  },
}))

const toasts: string[] = []
vi.mock('@/lib/toast', () => ({
  toast: {
    success: (message: string) => toasts.push(`success: ${message}`),
    error: (message: string) => toasts.push(`error: ${message}`),
  },
}))

const copy = geneSearchCopy.isoformTable
const splitCopy = geneSearchCopy.splitPreview
const terms = geneSearchCopy.terms

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
  downloads.length = 0
  toasts.length = 0
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('IsoformTable on a narrow screen', () => {
  it('keeps AAV fit, and its sort control, at every width', async () => {
    renderTable({ isoforms: [dual] })
    await flush()

    const header = screen
      .getByRole('button', { name: terms.suitability.label })
      .closest('th')!
    // `hidden lg:table-cell` took the column — and with it the only way to
    // see or clear a shared `?sort=suitability` — off every phone.
    expect(header.className).not.toContain('hidden')

    const cell = document
      .getElementById(`isoform-row-${dual.id}`)!
      .querySelectorAll('td')[7]
    expect(cell.className).not.toContain('hidden')
    // The tier is named for a screen reader even where the badge is short.
    expect(cell.textContent).toContain('2×')
    expect(cell.textContent).toContain('Dual AAV')
  })

  it('pins the header over the rows it labels', async () => {
    renderTable({ isoforms: [dual, triple] })
    await flush()

    const head = document.querySelector('thead')!
    expect(head.className).toContain('sticky')
    expect(head.className).toContain('top-0')
    // The sticky header needs a scroller with a height of its own, or it
    // has nothing to stick to.
    const container = head.closest('[data-slot="table-container"]')!
    expect(container.className).toMatch(/max-h-/)
    expect(container.className).toContain('overflow-auto')
  })
})

describe('IsoformTable naming', () => {
  // The gene page has two tables; the identity matrix carried a caption and
  // this one was anonymous in a screen reader's table list.
  it('names itself after the gene', async () => {
    renderTable({ isoforms: [dual] })
    await flush()

    expect(
      screen.getByRole('table', { name: copy.caption('NF1') }),
    ).toBeTruthy()
  })

  it('names the isoform its row menu acts on', async () => {
    renderTable({ isoforms: [dual, triple] })
    await flush()
    openMenu(screen.getByLabelText(copy.moreAria(dual.id)))

    const menu = await screen.findByRole('menu')
    // Six items, none of which said which transcript they belonged to — and
    // on a phone the menu covers its own row and leaves the one above it
    // showing.
    expect(menu.textContent).toContain(dual.id)
    expect(menu.textContent).not.toContain(triple.id)
  })

  it('explains the columns a phone drops, where it drops them', async () => {
    renderTable({ isoforms: [dual] })
    await flush()
    fireEvent.click(screen.getByLabelText(copy.expandRowAria(dual.id)))

    // CpG and WGGW only appear on a phone in the expanded row, so without
    // their infotips there they had no explanation on a phone at all.
    for (const term of [terms.gc, terms.cpg, terms.wggw]) {
      expect(
        screen.getAllByLabelText(commonCopy.termHintAria(term.label)).length,
      ).toBeGreaterThan(1)
    }
  })
})

describe('IsoformTable copy and download actions', () => {
  it('says so when a copy succeeds, not only when it fails', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))

    renderTable({ isoforms: [dual] })
    await flush()
    openMenu(screen.getByLabelText(copy.moreAria(dual.id)))

    // The menu closes on click, so the swapped "Copied!" label was never
    // seen: only the failure path said anything at all.
    fireEvent.click(await screen.findByText(copy.copyCds))
    await flush()
    expect(writeText).toHaveBeenCalledWith(dual.codingSequence)
    expect(toasts).toEqual([`success: ${copy.copiedCds(dual.id)}`])
  })

  it('distinguishes its FASTA download from the gene’s, and keeps the context', async () => {
    renderTable({ isoforms: [dual] })
    await flush()
    openMenu(screen.getByLabelText(copy.moreAria(dual.id)))

    const item = await screen.findByText(copy.downloadFasta)
    // Two downloads on one page: the summary strip's is every isoform.
    expect(copy.downloadFasta).not.toBe(copy.downloadAllFasta)

    fireEvent.click(item)
    const [name, text] = downloads.at(-1)!
    expect(name).toBe(`NF1_${dual.id}_CDS.fasta`)
    // A bare `>ENST…` in a folder of twenty says nothing about the gene.
    expect(text.split('\n')[0]).toBe(
      `>${dual.id} NF1 CDS=${dual.codingSequenceLength}bp`,
    )
  })
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

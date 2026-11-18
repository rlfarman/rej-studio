import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { cleanup } from '@testing-library/react'

import { geneSearchCopy } from '../copy'
import { parseIsoformIdentity } from '../corpus/identity'
import type { IsoformListItem } from '../types/domain-types'
import { IsoformIdentityMatrix } from './isoform-identity-matrix'

const copy = geneSearchCopy.identityMatrix

afterEach(cleanup)

const isoform = (id: string, length: number): IsoformListItem => ({
  id,
  codingSequenceLength: length * 3,
  proteinSequenceLength: length,
  codingSequence: '',
  proteinSequence: '',
  species: 'human',
})

/** Enough isoforms that the grid is wider than any phone. */
const isoforms = Array.from({ length: 16 }, (_, i) =>
  isoform(`ENST${String(i).padStart(11, '0')}`, 100 + i),
)
const identity = parseIsoformIdentity(
  {
    isoforms: [...isoforms].reverse().map(({ id }) => id),
    permille: Array.from({ length: 120 }, () => 900),
  },
  isoforms,
)

function renderOnGenePage() {
  const rootRoute = createRootRoute({ component: Outlet })
  const geneRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/genes/$symbol',
    component: () => (
      <IsoformIdentityMatrix isoforms={isoforms} identity={identity} />
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([geneRoute]),
    history: createMemoryHistory({ initialEntries: ['/genes/TP53'] }),
  })
  return render(<RouterProvider router={router} />)
}

/**
 * jsdom has no stylesheet and no layout, so these tests cannot measure the
 * page. What they can hold is the structure the bug was made of: how many
 * elements are asked to scroll, and whether the grid's box is allowed to
 * reach outside the card it sits in.
 */
const SCROLLS = /^overflow(-[xy])?-(auto|scroll|hidden)$/
const BLEEDS = /^-m[xl]?-/

describe('the identity matrix scrolls inside its own card', () => {
  it('owns exactly one horizontal scroller, inside the section', async () => {
    const { container } = renderOnGenePage()
    const grid = await screen.findByRole('table', { name: copy.caption })

    const scrollers: Element[] = []
    for (
      let el: Element | null = grid;
      el && el !== container;
      el = el.parentElement
    ) {
      if ([...el.classList].some((name) => SCROLLS.test(name))) {
        scrollers.push(el)
      }
    }

    // A second scroller around the first takes the swipe, so dragging the
    // card pans the page instead of the grid, and the sticky row labels —
    // pinned to the inner one — scroll away with the columns.
    expect(scrollers).toHaveLength(1)
    const scroller = scrollers[0]
    expect(scroller).toBe(grid.parentElement)
    expect(scroller.closest('section')).not.toBeNull()
  })

  it('does not let the grid bleed outside the card with a negative margin', async () => {
    renderOnGenePage()
    const grid = await screen.findByRole('table', { name: copy.caption })

    const scroller = grid.parentElement!
    expect([...scroller.classList].filter((name) => BLEEDS.test(name))).toEqual(
      [],
    )
  })

  it('keeps the row labels pinned and opaque', async () => {
    renderOnGenePage()
    const grid = await screen.findByRole('table', { name: copy.caption })

    const rowHeaders = [...grid.querySelectorAll('tbody th')]
    // A lower triangle: every isoform but the first has a row.
    expect(rowHeaders).toHaveLength(isoforms.length - 1)
    for (const header of rowHeaders) {
      expect(header.className).toContain('sticky')
      expect(header.className).toContain('left-0')
      // The section has no background of its own, so the labels have to
      // paint the page's — otherwise cells show through as they pass under.
      expect(header.className).toContain('bg-background')
    }
  })
})

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import type { SearchGenesResult } from '../types/search'
import { geneSearchCopy } from '../copy'
import { GeneSearchResultsView } from './gene-search-results-view'

const pageCopy = geneSearchCopy.searchPage

function gene(symbol: string, species = 'human') {
  return {
    id: `${symbol}-${species}`,
    symbol,
    name: `${symbol} protein`,
    species,
  }
}

/** The view renders Links, so it needs a router around it. */
function renderView(props: {
  query: string
  data: SearchGenesResult
  moreCount?: number
  onShowMore?: () => void
}) {
  const rootRoute = createRootRoute({ component: Outlet })
  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <GeneSearchResultsView species="both" {...props} />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      page,
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/genes/$symbol',
        component: () => null,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/design-tool',
        component: () => null,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/disease-associations',
        component: () => null,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('GeneSearchResultsView', () => {
  // Finding 13: a cut-off list said "the first 50" and nothing about how
  // many there were, though the search had already counted them.
  it('says how many genes matched, not just how many are shown', async () => {
    renderView({
      query: 'kinase',
      data: {
        results: [gene('MAPK1'), gene('MAPK3')],
        truncated: true,
        total: 312,
        suggestions: [],
      },
    })

    expect(await screen.findByText(pageCopy.truncated(2, 312))).toBeTruthy()
  })

  it('counts the results when nothing was cut off', async () => {
    renderView({
      query: 'brca1',
      data: {
        results: [gene('BRCA1')],
        truncated: false,
        total: 1,
        suggestions: [],
      },
    })

    expect(await screen.findByText(pageCopy.resultCount(1))).toBeTruthy()
  })

  it('offers more rows only when there are more to show', async () => {
    const onShowMore = vi.fn()
    renderView({
      query: 'kinase',
      data: {
        results: [gene('MAPK1')],
        truncated: true,
        total: 312,
        suggestions: [],
      },
      moreCount: 49,
      onShowMore,
    })

    const button = await screen.findByRole('button', {
      name: pageCopy.showMoreAria(49),
    })
    fireEvent.click(button)
    expect(onShowMore).toHaveBeenCalledTimes(1)
  })

  it('hides the control once everything that will be shown is shown', async () => {
    renderView({
      query: 'brca',
      data: {
        results: [gene('BRCA1')],
        truncated: false,
        total: 1,
        suggestions: [],
      },
      moreCount: 0,
      onShowMore: vi.fn(),
    })

    await screen.findByText(pageCopy.resultCount(1))
    expect(screen.queryByText(pageCopy.showMore)).toBeNull()
  })

  // Finding 11: suggestions ignore the species filter, so under "No mouse
  // genes match INS" the chip read "INS" with only a decorative icon to say
  // it was the human gene.
  it('names the species of every "did you mean" suggestion', async () => {
    renderView({
      query: 'ins',
      data: {
        results: [],
        truncated: false,
        total: 0,
        suggestions: [{ symbol: 'INS', species: 'human' }],
      },
    })

    const suggestion = await screen.findByRole('link', { name: /INS/ })
    expect(suggestion.textContent).toContain('INS')
    expect(suggestion.textContent).toContain('Human')
  })
})

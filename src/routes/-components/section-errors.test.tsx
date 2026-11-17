import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  type ErrorRouteComponent,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'
import { DesignToolError } from './design-tool-error'
import { SearchError } from './genes/search-error'

// The per-section boundaries that replaced Next's (search)/error.tsx and
// (design-tool)/error.tsx: a page that throws until `broken` is cleared,
// behind the section's error component.
function renderBrokenPage(errorComponent: ErrorRouteComponent) {
  const state = { broken: true }
  const rootRoute = createRootRoute({ component: Outlet })
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: function Page() {
      if (state.broken) throw new Error('boom')
      return <h1>fixed</h1>
    },
    errorComponent,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  return state
}

describe('SearchError', () => {
  it('says search is unavailable, with a link home', async () => {
    renderBrokenPage(SearchError)
    expect(
      await screen.findByText(appCopy.errorBoundary.search.title),
    ).toBeTruthy()
    const home = screen.getByText(commonCopy.actions.goHome).closest('a')
    expect(home?.getAttribute('href')).toBe('/')
  })

  it('renders the page again on "Try again"', async () => {
    const state = renderBrokenPage(SearchError)
    const retry = await screen.findByRole('button', {
      name: commonCopy.actions.tryAgain,
    })
    state.broken = false
    fireEvent.click(retry)
    expect(await screen.findByRole('heading', { name: 'fixed' })).toBeTruthy()
  })
})

describe('DesignToolError', () => {
  it('says the design tool failed, with a link back to search', async () => {
    renderBrokenPage(DesignToolError)
    expect(
      await screen.findByText(appCopy.errorBoundary.designTool.title),
    ).toBeTruthy()
    const back = screen
      .getByText(appCopy.errorBoundary.designTool.backToSearch)
      .closest('a')
    expect(back?.getAttribute('href')).toBe('/genes')
  })

  it('renders the page again on "Try again"', async () => {
    const state = renderBrokenPage(DesignToolError)
    const retry = await screen.findByRole('button', {
      name: commonCopy.actions.tryAgain,
    })
    state.broken = false
    fireEvent.click(retry)
    expect(await screen.findByRole('heading', { name: 'fixed' })).toBeTruthy()
  })
})

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { appCopy } from '@/copy/app'
import { SearchError } from './search-error'

// One boundary covers /genes and /genes/$symbol, and what it should say
// depends on which of the two threw.
function renderBrokenRoute(path: string, url: string, error: Error) {
  const rootRoute = createRootRoute({ component: Outlet })
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: function Page() {
      throw error
    },
    errorComponent: SearchError,
  })
  render(
    <RouterProvider
      router={createRouter({
        routeTree: rootRoute.addChildren([pageRoute]),
        history: createMemoryHistory({ initialEntries: [url] }),
      })}
    />,
  )
}

describe('SearchError', () => {
  it('names the gene when a gene page fails to load', async () => {
    renderBrokenRoute(
      '/genes/$symbol',
      '/genes/EGFR',
      new Error('Gene data /genes/ENSG1.json: HTTP 503'),
    )
    expect(
      await screen.findByText(appCopy.errorBoundary.gene.title('EGFR')),
    ).toBeTruthy()
    // A blocked fetch is not a bug in the page, and should not read as one.
    expect(
      screen.getByText(appCopy.errorBoundary.connectionEyebrow),
    ).toBeTruthy()
  })

  it('says search is unavailable on the search page', async () => {
    renderBrokenRoute('/genes', '/genes', new Error('boom'))
    expect(
      await screen.findByText(appCopy.errorBoundary.search.title),
    ).toBeTruthy()
    expect(screen.getByText(appCopy.errorBoundary.eyebrow)).toBeTruthy()
  })
})

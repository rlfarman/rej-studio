import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'
import { RouteError } from './route-error'

// A page that throws until `broken` is cleared, behind the same default
// error component the app's router uses.
function renderBrokenPage() {
  const state = { broken: true }
  const rootRoute = createRootRoute({ component: Outlet })
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: function Page() {
      if (state.broken) throw new Error('boom')
      return <h1>fixed</h1>
    },
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultErrorComponent: RouteError,
  })
  render(<RouterProvider router={router} />)
  return state
}

describe('RouteError', () => {
  it('shows the error page with a link home', async () => {
    renderBrokenPage()
    expect(
      await screen.findByRole('heading', { name: appCopy.errorBoundary.title }),
    ).toBeTruthy()
    const home = screen.getByText(commonCopy.actions.goHome).closest('a')
    expect(home?.getAttribute('href')).toBe('/')
  })

  it('renders the page again on "Try again"', async () => {
    const state = renderBrokenPage()
    const retry = await screen.findByRole('button', {
      name: commonCopy.actions.tryAgain,
    })
    state.broken = false
    fireEvent.click(retry)
    expect(await screen.findByRole('heading', { name: 'fixed' })).toBeTruthy()
  })
})

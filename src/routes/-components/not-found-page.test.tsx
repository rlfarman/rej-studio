import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'
import { NotFoundPage } from './not-found-page'

function renderAt(path: string) {
  const rootRoute = createRootRoute({ component: Outlet })
  const home = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <h1>home</h1>,
  })
  const catchAll = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: NotFoundPage,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([home, catchAll]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

describe('NotFoundPage', () => {
  it('offers no way back when the 404 is the first page of the visit', async () => {
    renderAt('/nowhere')
    expect(
      await screen.findByRole('heading', { name: appCopy.notFound.title }),
    ).toBeTruthy()
    // Back from a pasted link would leave the app.
    expect(
      screen.queryByRole('button', { name: commonCopy.actions.goBack }),
    ).toBeNull()
  })

  it('offers to go back after a link inside the app led here', async () => {
    const router = renderAt('/')
    await screen.findByRole('heading', { name: 'home' })
    await act(() => router.navigate({ to: '/$', params: { _splat: 'gone' } }))
    expect(
      await screen.findByRole('button', { name: commonCopy.actions.goBack }),
    ).toBeTruthy()
  })
})

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vite-plus/test'

import { geneSearchCopy } from '../copy'
import { parseIsoformIdentity } from '../corpus/identity'
import type { IsoformListItem } from '../types/domain-types'
import { IsoformIdentityMatrix } from './isoform-identity-matrix'

const copy = geneSearchCopy.identityMatrix

const isoform = (id: string, length: number): IsoformListItem => ({
  id,
  codingSequenceLength: length * 3,
  proteinSequenceLength: length,
  codingSequence: '',
  proteinSequence: '',
  species: 'human',
})

// Display order is longest first: ENST2, ENST3, ENST1.
const isoforms = [
  isoform('ENST1', 50),
  isoform('ENST2', 300),
  isoform('ENST3', 100),
]
const identity = parseIsoformIdentity(
  { isoforms: ['ENST2', 'ENST3', 'ENST1'], permille: [642, 125, 1000] },
  isoforms,
)

// The row headers link within the gene page, so it renders under that route.
function renderOnGenePage(ui: ReactNode) {
  const rootRoute = createRootRoute({ component: Outlet })
  const geneRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/genes/$symbol',
    component: () => ui,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([geneRoute]),
    history: createMemoryHistory({ initialEntries: ['/genes/TP53'] }),
  })
  render(<RouterProvider router={router} />)
}

describe('IsoformIdentityMatrix', () => {
  it('shows the stored identities, longest isoform first', async () => {
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={isoforms} identity={identity} />,
    )
    const table = await screen.findByRole('table', { name: copy.caption })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(
      rows.map((row) => within(row).getByRole('link').getAttribute('title')),
    ).toEqual(['ENST2', 'ENST3', 'ENST1'].map(copy.jumpTo))
    expect(
      screen.getByTitle(copy.cellLabel('64.2', 'ENST3', 'ENST2')),
    ).toBeTruthy()
    expect(
      screen.getByTitle(copy.cellLabel('12.5', 'ENST1', 'ENST2')),
    ).toBeTruthy()
    expect(
      screen.getByTitle(copy.cellLabel('100.0', 'ENST1', 'ENST3')),
    ).toBeTruthy()
    expect(screen.getByText(copy.footnote)).toBeTruthy()
    expect(screen.queryByText(copy.unavailable)).toBeNull()
  })

  it('says identities are unavailable rather than estimating them', async () => {
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={isoforms} identity={null} />,
    )
    expect(await screen.findByText(copy.unavailable)).toBeTruthy()
    expect(screen.getByRole('heading', { name: copy.title })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders nothing for a gene with one isoform', async () => {
    renderOnGenePage(
      <div data-testid="page">
        <IsoformIdentityMatrix
          isoforms={[isoform('ENST1', 10)]}
          identity={null}
        />
      </div>,
    )
    expect((await screen.findByTestId('page')).childElementCount).toBe(0)
  })

  it('says when only the longest isoforms are shown', async () => {
    const many = Array.from({ length: 18 }, (_, i) =>
      isoform(`ENST${String(i).padStart(2, '0')}`, 100 + i),
    )
    const shownIds = [...many]
      .reverse()
      .slice(0, 16)
      .map(({ id }) => id)
    const stored = parseIsoformIdentity(
      { isoforms: shownIds, permille: Array.from({ length: 120 }, () => 900) },
      many,
    )
    renderOnGenePage(
      <IsoformIdentityMatrix isoforms={many} identity={stored} />,
    )
    expect(
      await screen.findByText(copy.truncated(16, 18), { exact: false }),
    ).toBeTruthy()
  })
})

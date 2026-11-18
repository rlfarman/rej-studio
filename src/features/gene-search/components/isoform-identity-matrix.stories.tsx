import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ComponentProps } from 'react'

import { parseIsoformIdentity } from '../corpus/identity'
import type { IsoformListItem } from '../types/domain-types'
import { IsoformIdentityMatrix } from './isoform-identity-matrix'

// The first six isoforms the sample corpus's TP53 page shows, with the
// identities the corpus build stored for them (tenths of a percent).
const TP53_IDS = [
  'ENST00000635293',
  'ENST00000269305',
  'ENST00000445888',
  'ENST00000610292',
  'ENST00000619485',
  'ENST00000620739',
]
const TP53_LENGTHS = [411, 394, 394, 355, 355, 355]
const TP53_PERMILLE = [
  744, 744, 815, 815, 815, 1000, 901, 901, 901, 901, 901, 901, 1000, 1000, 1000,
]

const isoforms: IsoformListItem[] = TP53_IDS.map((id, i) => ({
  id,
  codingSequenceLength: TP53_LENGTHS[i] * 3,
  proteinSequenceLength: TP53_LENGTHS[i],
  codingSequence: '',
  proteinSequence: '',
  species: 'human',
}))

type Props = ComponentProps<typeof IsoformIdentityMatrix>

// The row headers link within the gene page, so stories render under it.
function OnGenePage(props: Props) {
  const rootRoute = createRootRoute()
  const geneRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/genes/$symbol',
    component: () => (
      <div className="w-[min(100vw,48rem)] p-4">
        <IsoformIdentityMatrix {...props} />
      </div>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([geneRoute]),
    history: createMemoryHistory({ initialEntries: ['/genes/TP53'] }),
  })
  return <RouterProvider router={router} />
}

const meta = {
  title: 'GeneSearch/IsoformIdentityMatrix',
  component: OnGenePage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof OnGenePage>

export default meta
type Story = StoryObj<typeof meta>

export const StoredIdentities: Story = {
  args: {
    isoforms,
    identity: parseIsoformIdentity(
      { isoforms: TP53_IDS, permille: TP53_PERMILLE },
      isoforms,
    ),
  },
}

/** A corpus built before identities were stored. */
export const Unavailable: Story = {
  args: { isoforms, identity: null },
}

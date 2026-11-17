import { createFileRoute } from '@tanstack/react-router'

import { appCopy } from '@/copy/app'
import { PagePlaceholder } from '../-components/page-placeholder'
import { optionalString } from '../-components/search-params'

export const Route = createFileRoute('/genes/$symbol')({
  // What the sidebar's favorites and recents link here with.
  // TODO(slice-2): the page's full search schema (species as SpeciesFilter).
  validateSearch: (
    search: Record<string, unknown>,
  ): { species?: string; isoform?: string } => ({
    species: optionalString(search.species),
    isoform: optionalString(search.isoform),
  }),
  head: ({ params }) => ({
    meta: [{ title: appCopy.metadata.title(params.symbol) }],
  }),
  component: GenePlaceholder,
})

function GenePlaceholder() {
  const { symbol } = Route.useParams()
  return <PagePlaceholder title={symbol} />
}

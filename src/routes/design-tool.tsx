import { createFileRoute } from '@tanstack/react-router'

import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'
import { PagePlaceholder } from './-components/page-placeholder'
import { optionalString } from './-components/search-params'

const title = commonCopy.pageContext.designTool

export const Route = createFileRoute('/design-tool')({
  // What the shell links here with: a design from history (`job`) or an
  // isoform from the search palette. TODO(slice-2): the page's full schema.
  validateSearch: (
    search: Record<string, unknown>,
  ): { job?: string; isoform?: string } => ({
    job: optionalString(search.job),
    isoform: optionalString(search.isoform),
  }),
  head: () => ({ meta: [{ title: appCopy.metadata.title(title) }] }),
  component: () => <PagePlaceholder title={title} />,
})

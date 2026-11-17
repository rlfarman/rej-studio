import { createFileRoute } from '@tanstack/react-router'

import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'
import { PagePlaceholder } from './-components/page-placeholder'

const title = commonCopy.pageContext.architecture

export const Route = createFileRoute('/architecture')({
  // Internal page: kept out of search engines, as before.
  head: () => ({
    meta: [
      { title: appCopy.metadata.title(title) },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: () => <PagePlaceholder title={title} />,
})

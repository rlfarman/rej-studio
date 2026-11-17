import { createFileRoute } from '@tanstack/react-router'

import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'
import { PagePlaceholder } from '../-components/page-placeholder'

const title = commonCopy.pageContext.genes

export const Route = createFileRoute('/genes/')({
  head: () => ({ meta: [{ title: appCopy.metadata.title(title) }] }),
  component: () => <PagePlaceholder title={title} />,
})

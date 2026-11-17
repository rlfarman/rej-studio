import { createFileRoute } from '@tanstack/react-router'

import { appCopy } from '@/copy/app'
import { PagePlaceholder } from './-components/page-placeholder'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: appCopy.home.metadataTitle }] }),
  component: () => <PagePlaceholder title={appCopy.home.ogTitle} />,
})

import { StatusPage } from '@/components/status-page'
import { appCopy } from '@/copy/app'

/**
 * Stand-in for a page that still lives in the Next app's history, so the
 * route, the sidebar's active state and the header label work before the
 * page itself is ported.
 *
 * TODO(slice-2): delete once every route renders its real page.
 */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <StatusPage
      eyebrow={appCopy.placeholder.eyebrow}
      title={title}
      description={appCopy.placeholder.detail}
    />
  )
}

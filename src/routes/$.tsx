import { createFileRoute } from '@tanstack/react-router'

import { appCopy } from '@/copy/app'
import { NotFoundPage } from './-components/not-found-page'

/**
 * Every URL no other route matches. A catch-all route rather than the root's
 * `notFoundComponent`, because of how the shell hydrates: `_shell.html` was
 * prerendered with a matched child's pending component in the page slot,
 * inside the Suspense boundaries the router puts around a child match. An
 * unmatched URL makes the root's `<Outlet>` render its not-found component
 * directly, without those boundaries, so hydration found a different tree
 * (React #418) whatever the component rendered. Matching here goes through
 * the same pending path as any other shell-served page.
 */
export const Route = createFileRoute('/$')({
  head: () => ({
    meta: [{ title: appCopy.metadata.title(appCopy.notFound.pageTitle) }],
  }),
  component: NotFoundPage,
})

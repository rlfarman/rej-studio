import { useEffect } from 'react'

/**
 * Sets the tab title for a state no route's `head()` can describe: the
 * not-found components, which render after their route has already said what
 * the page is.
 *
 * The next navigation renders `HeadContent` with its own title, which
 * replaces this one, so there is nothing to restore on unmount.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}

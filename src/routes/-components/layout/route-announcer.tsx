import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

/**
 * Tells a screen-reader user that the page changed, and puts the keyboard
 * back at the top of the new page.
 *
 * In a single-page app a navigation replaces the content silently: focus
 * stays on the link that was clicked, and nothing is announced. This reads
 * the new tab title into a polite live region and moves focus to
 * `#main-content` (which carries `tabIndex={-1}` for exactly this), so the
 * next Tab walks the new page rather than the rest of the sidebar.
 *
 * Only a change of **path** counts. The design tool rewrites its own search
 * params while someone is working (`?job=`, `?isoform=`), and stealing focus
 * out of the sequence field for that would be worse than saying nothing.
 *
 * It renders nothing until a navigation happens, so the prerendered shell
 * and the browser's hydrating render agree (an empty live region).
 */
export function RouteAnnouncer() {
  const router = useRouter()
  const [message, setMessage] = useState('')

  useEffect(() => {
    let lastPathname = router.state.location.pathname
    let frame = 0
    const unsubscribe = router.subscribe('onResolved', ({ toLocation }) => {
      if (toLocation.pathname === lastPathname) return
      lastPathname = toLocation.pathname
      document.getElementById('main-content')?.focus({ preventScroll: true })
      // The new route's head renders with the page; read the title after
      // that paint, or we would announce the title of the page we left.
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setMessage(document.title))
    })
    return () => {
      cancelAnimationFrame(frame)
      unsubscribe()
    }
  }, [router])

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}

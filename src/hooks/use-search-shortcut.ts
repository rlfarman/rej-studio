import { useEffect, useEffectEvent } from 'react'

/** Calls `onTrigger` when ⌘K / Ctrl+K is pressed anywhere on the page. */
export function useSearchShortcut(onTrigger: () => void) {
  const trigger = useEffectEvent(onTrigger)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        trigger()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}

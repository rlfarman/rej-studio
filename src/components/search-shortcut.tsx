import { Kbd, ModKey } from '@/components/ui/kbd'
import { useSearchShortcut } from '@/hooks/use-search-shortcut'
import { cn } from '@/lib/utils'

/**
 * ⌘K / Ctrl+K focuses the page's own search box. Pages that have one hide
 * the header's search palette, so without this the shortcut did nothing
 * there.
 */
export function SearchShortcutFocus({ targetId }: { targetId: string }) {
  useSearchShortcut(() => {
    const el = document.getElementById(targetId)
    if (el instanceof HTMLInputElement) {
      el.focus()
      el.select()
    }
  })
  return null
}

/**
 * The visible ⌘K hint for a search box. Decorative — the input itself
 * carries `aria-keyshortcuts` — and hidden on touch-sized screens.
 */
export function SearchShortcutHint({ className }: { className?: string }) {
  return (
    <Kbd aria-hidden className={cn('hidden md:inline-flex', className)}>
      <ModKey /> K
    </Kbd>
  )
}

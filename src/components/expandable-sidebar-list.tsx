'use client'
import { Fragment, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const DEFAULT_COLLAPSED_COUNT = 3
const DEFAULT_EXPANDED_MAX = 15

// Persisted open/closed state is read from localStorage through
// useSyncExternalStore: the server snapshot (null → `defaultOpen`) keeps SSR
// and hydration in agreement, and the stored value takes over right after
// hydration — without a setState inside an effect. Writes dispatch this event
// so every list sharing a key re-reads the store.
const OPEN_STATE_EVENT = 'expandable-sidebar-list:open-state'

function subscribeToOpenState(onChange: () => void) {
  window.addEventListener(OPEN_STATE_EVENT, onChange)
  return () => window.removeEventListener(OPEN_STATE_EVENT, onChange)
}

function readStoredOpen(persistKey: string | undefined): boolean | null {
  if (!persistKey) return null
  try {
    const stored = window.localStorage.getItem(persistKey)
    return stored === null ? null : stored === '1'
  } catch {
    return null // localStorage unavailable
  }
}

/** Returns false when localStorage is unavailable, so callers can fall back. */
function writeStoredOpen(persistKey: string, open: boolean): boolean {
  try {
    window.localStorage.setItem(persistKey, open ? '1' : '0')
  } catch {
    return false
  }
  window.dispatchEvent(new Event(OPEN_STATE_EVENT))
  return true
}

interface ExpandableSidebarListProps<T> {
  label: string
  items: readonly T[]
  getItemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  /**
   * Shown when the list is empty. Omit it to hide the whole section instead,
   * so empty history sections don't stack up as a column of "nothing here".
   */
  emptyMessage?: string
  onClear?: () => void
  collapsedCount?: number
  expandedMax?: number
  menuAriaLabel?: string
  /** Key used to persist the open/closed state in localStorage. */
  persistKey?: string
  /** Initial open state when no persisted value exists. */
  defaultOpen?: boolean
}

export function ExpandableSidebarList<T>({
  label,
  items,
  getItemKey,
  renderItem,
  emptyMessage,
  onClear,
  collapsedCount = DEFAULT_COLLAPSED_COUNT,
  expandedMax = DEFAULT_EXPANDED_MAX,
  menuAriaLabel,
  persistKey,
  defaultOpen = true,
}: ExpandableSidebarListProps<T>) {
  const [expanded, setExpanded] = useState(false)
  // Used when nothing is persisted (no key, no stored value, or no storage).
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const storedOpen = useSyncExternalStore(
    subscribeToOpenState,
    () => readStoredOpen(persistKey),
    () => null,
  )
  const open = storedOpen ?? localOpen

  const toggleOpen = () => {
    const next = !open
    if (persistKey && writeStoredOpen(persistKey, next)) return
    setLocalOpen(next)
  }

  const hiddenCount = items.length - collapsedCount
  const visibleItems = expanded
    ? items.slice(0, expandedMax)
    : items.slice(0, collapsedCount)

  const hasItems = items.length > 0
  const showClear = hasItems && onClear !== undefined
  const sectionId = `sidebar-section-${label.toLowerCase().replace(/\s+/g, '-')}`

  if (!hasItems && emptyMessage === undefined) return null

  return (
    <SidebarGroup>
      <div className="bg-sidebar sticky top-0 z-10 flex items-center justify-between gap-1">
        <SidebarGroupLabel asChild className="min-w-0 flex-1 shrink">
          <button
            type="button"
            onClick={toggleOpen}
            aria-expanded={open}
            aria-controls={sectionId}
            className="flex w-full min-w-0 items-center gap-1.5 text-left"
          >
            <ChevronRight
              className={cn(
                'size-3 flex-shrink-0 transition-transform duration-150',
                open && 'rotate-90',
              )}
            />
            <span className="truncate">{label}</span>
            {hasItems && (
              <span className="text-muted-foreground type-micro ml-auto font-mono tabular-nums">
                {items.length}
              </span>
            )}
          </button>
        </SidebarGroupLabel>
        {showClear && open && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-xs"
          >
            Clear
          </Button>
        )}
      </div>
      {open && (
        <SidebarGroupContent id={sectionId}>
          {hasItems ? (
            <>
              <SidebarMenu aria-live="polite" aria-label={menuAriaLabel}>
                {visibleItems.map((item) => (
                  <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>
                ))}
              </SidebarMenu>
              {hiddenCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="text-muted-foreground w-full text-xs"
                >
                  {expanded ? 'Show less' : `+ Show ${hiddenCount} more`}
                </Button>
              )}
            </>
          ) : (
            <div className="text-muted-foreground p-4 text-xs">
              {emptyMessage}
            </div>
          )}
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  )
}

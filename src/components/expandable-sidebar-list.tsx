'use client'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
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

interface ExpandableSidebarListProps<T> {
  label: string
  items: readonly T[]
  getItemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  emptyMessage: string
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
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!persistKey) return
    try {
      const stored = window.localStorage.getItem(persistKey)
      if (stored !== null) setOpen(stored === '1')
    } catch {
      /* localStorage unavailable */
    }
  }, [persistKey])

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev
      if (persistKey) {
        try {
          window.localStorage.setItem(persistKey, next ? '1' : '0')
        } catch {
          /* localStorage unavailable */
        }
      }
      return next
    })
  }

  const hiddenCount = items.length - collapsedCount
  const visibleItems = expanded
    ? items.slice(0, expandedMax)
    : items.slice(0, collapsedCount)

  const hasItems = items.length > 0
  const showClear = hasItems && onClear !== undefined
  const sectionId = `sidebar-section-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <SidebarGroup>
      <div className="bg-sidebar sticky top-0 z-10 flex items-center justify-between gap-1">
        <SidebarGroupLabel asChild>
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
              <span className="text-muted-foreground ml-auto font-mono text-[10px] tabular-nums">
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

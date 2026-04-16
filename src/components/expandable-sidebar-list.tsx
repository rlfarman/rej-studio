'use client'
import { Fragment, useState, type ReactNode } from 'react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'

const DEFAULT_COLLAPSED_COUNT = 3
const DEFAULT_EXPANDED_MAX = 15

interface ExpandableSidebarListProps<T> {
  label: ReactNode
  items: readonly T[]
  getItemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  emptyMessage: string
  onClear?: () => void
  collapsedCount?: number
  expandedMax?: number
  menuAriaLabel?: string
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
}: ExpandableSidebarListProps<T>) {
  const [expanded, setExpanded] = useState(false)

  const hiddenCount = items.length - collapsedCount
  const visibleItems = expanded
    ? items.slice(0, expandedMax)
    : items.slice(0, collapsedCount)

  const hasItems = items.length > 0
  const showClear = hasItems && onClear !== undefined

  return (
    <SidebarGroup>
      {showClear ? (
        <div className="bg-sidebar sticky top-0 z-10 flex items-center justify-between">
          <SidebarGroupLabel>{label}</SidebarGroupLabel>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-xs"
          >
            Clear
          </Button>
        </div>
      ) : (
        <SidebarGroupLabel className="bg-sidebar sticky top-0 z-10">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
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
    </SidebarGroup>
  )
}

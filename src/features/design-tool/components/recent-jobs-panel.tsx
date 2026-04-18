'use client'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  useJobHistory,
  type JobHistoryEntry,
} from '@/features/design-tool/hooks/use-job-history'
import { cancelJob as cancelJobAction } from '@/features/design-tool/api/jobs'
import { ExpandableSidebarList } from '@/components/expandable-sidebar-list'
import { Loader2, CircleAlert, X } from 'lucide-react'
import { designToolCopy } from '../copy'

const copy = designToolCopy.recentJobs

function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  )
  if (seconds < 60) return copy.justNow
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return copy.minutesAgo(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return copy.hoursAgo(hours)
  const days = Math.floor(hours / 24)
  return copy.daysAgo(days)
}

interface RecentJobsProps {
  onSelectJob?: (entry: JobHistoryEntry) => void
}

export function RecentJobs({ onSelectJob }: RecentJobsProps) {
  // Selector-scoped reads so this component only re-renders when the
  // relevant slice changes, not on every unrelated store mutation.
  const entries = useJobHistory((s) => s.entries)
  const clearHistory = useJobHistory((s) => s.clearHistory)
  const removeEntry = useJobHistory((s) => s.removeEntry)
  const upsertEntry = useJobHistory((s) => s.upsertEntry)

  // X on a running entry cancels the backend job (eagerly marking it
  // cancelled in the store) rather than silently dismissing while the
  // job keeps running. Terminal entries are just removed locally.
  const handleRemove = (entry: JobHistoryEntry) => {
    if (entry.status === 'running') {
      upsertEntry({
        id: entry.id,
        status: 'cancelled',
        error: {
          code: 'cancelled',
          message: copy.cancelledMessage,
          retriable: true,
        },
      })
      void cancelJobAction(entry.id).catch(() => {})
    } else {
      removeEntry(entry.id)
    }
  }

  return (
    <ExpandableSidebarList
      label={copy.label}
      items={entries}
      getItemKey={(entry) => entry.id}
      onClear={clearHistory}
      emptyMessage={copy.empty}
      menuAriaLabel={copy.menuAria}
      renderItem={(entry) => {
        const isError =
          entry.status === 'failed' || entry.status === 'cancelled'
        const subline =
          entry.status === 'running'
            ? (entry.stage ??
              (entry.progress !== undefined
                ? `${Math.round(entry.progress * 100)}%`
                : copy.running))
            : isError && entry.error
              ? entry.error.message
              : formatTimeAgo(entry.createdAt)
        return (
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              className="h-auto items-start py-1.5 [&>svg]:size-3"
              onClick={() => onSelectJob?.(entry)}
            >
              {entry.status === 'running' && (
                <Loader2 className="mt-0.5 flex-shrink-0 animate-spin" />
              )}
              {isError && (
                <CircleAlert className="text-destructive mt-0.5 flex-shrink-0" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                <span className="line-clamp-2 pr-5 font-medium">
                  {entry.name}
                </span>
                <span
                  className={
                    isError && entry.error
                      ? 'text-destructive/80 line-clamp-2 pr-5 text-[11px]'
                      : 'text-muted-foreground group-hover/menu-button:text-sidebar-accent-foreground line-clamp-2 pr-5 text-[11px]'
                  }
                >
                  {subline}
                </span>
              </div>
            </SidebarMenuButton>
            <SidebarMenuAction
              showOnHover
              onClick={() => handleRemove(entry)}
              aria-label={
                entry.status === 'running'
                  ? copy.cancelAria(entry.name)
                  : copy.removeAria(entry.name)
              }
            >
              <X />
            </SidebarMenuAction>
          </SidebarMenuItem>
        )
      }}
    />
  )
}

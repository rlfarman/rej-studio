'use client'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  isSeedId,
  useJobHistory,
  type JobHistoryEntry,
} from '@/features/design-tool/hooks/use-job-history'
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
  /**
   * Stops a running design on its server backend (best effort). Without
   * it, cancelling only updates history.
   *
   * TODO(slice-3): drop with the server job path. The Start app has no job
   * backend, so it doesn't pass this.
   */
  onCancelJob?: (id: string) => void
}

export function RecentJobs({ onSelectJob, onCancelJob }: RecentJobsProps) {
  // Selector-scoped reads so this component only re-renders when the
  // relevant slice changes, not on every unrelated store mutation.
  const entries = useJobHistory((s) => s.entries)
  const progressById = useJobHistory((s) => s.progressById)
  const clearHistory = useJobHistory((s) => s.clearHistory)
  const removeEntry = useJobHistory((s) => s.removeEntry)
  const upsertEntry = useJobHistory((s) => s.upsertEntry)

  // Clearing the list must not leave workers running and billing: cancel
  // every running job (best effort) before dropping the entries.
  const handleClear = () => {
    for (const id of useJobHistory.getState().getRunningIds()) {
      if (isSeedId(id)) continue
      onCancelJob?.(id)
    }
    clearHistory()
  }

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
      onCancelJob?.(entry.id)
    } else {
      removeEntry(entry.id)
    }
  }

  return (
    <ExpandableSidebarList
      label={copy.label}
      persistKey="sidebar:recent-jobs:open"
      items={entries}
      getItemKey={(entry) => entry.id}
      onClear={handleClear}
      emptyMessage={copy.empty}
      menuAriaLabel={copy.menuAria}
      renderItem={(entry) => {
        const isError =
          entry.status === 'failed' || entry.status === 'cancelled'
        const progress = progressById[entry.id]
        const subline =
          entry.status === 'running'
            ? (progress?.stage ??
              (progress?.progress !== undefined
                ? `${Math.round(progress.progress * 100)}%`
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
                <CircleAlert className="mt-0.5 flex-shrink-0 text-destructive" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                <span className="line-clamp-2 pr-5 font-medium">
                  {entry.name}
                </span>
                <span className="line-clamp-2 block min-h-[14px] pr-5 type-nano text-muted-foreground group-hover/menu-button:text-sidebar-accent-foreground">
                  {subline}
                </span>
                {entry.status === 'running' &&
                  progress?.progress !== undefined && (
                    <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-sidebar-border">
                      <div
                        className="h-full w-full origin-left bg-primary transition-transform duration-700 ease-out"
                        style={{
                          transform: `scaleX(${Math.max(0.02, progress.progress)})`,
                        }}
                      />
                    </div>
                  )}
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

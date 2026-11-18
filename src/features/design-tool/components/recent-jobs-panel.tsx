import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  useJobHistory,
  type JobHistoryEntry,
} from '@/features/design-tool/hooks/use-job-history'
import { ExpandableSidebarList } from '@/components/expandable-sidebar-list'
import { cancelBrowserRun } from '@/features/design-tool/api/browser-optimizer'
import { Loader2, CircleAlert, Cloud, X } from 'lucide-react'
import { estimateCloudSeconds } from '@/features/design-tool/types/cloud-design'
import { formatTimeAgo } from '@/features/design-tool/utils/time-ago'
import { designToolCopy } from '../copy'

const copy = designToolCopy.recentJobs
const cloudCopy = designToolCopy.cloud

interface RecentJobsProps {
  onSelectJob?: (entry: JobHistoryEntry) => void
}

export function RecentJobs({ onSelectJob }: RecentJobsProps) {
  // Selector-scoped reads so this component only re-renders when the
  // relevant slice changes, not on every unrelated store mutation.
  const entries = useJobHistory((s) => s.entries)
  const progressById = useJobHistory((s) => s.progressById)
  const clearHistory = useJobHistory((s) => s.clearHistory)
  const removeEntry = useJobHistory((s) => s.removeEntry)
  const upsertEntry = useJobHistory((s) => s.upsertEntry)

  // X on a running entry cancels it rather than silently dismissing it.
  // Terminal entries are just removed.
  const handleRemove = (entry: JobHistoryEntry) => {
    if (entry.status === 'running') {
      // Stop the work first: the history entry alone would leave the worker
      // running and its result overwriting this in a few seconds. A cloud
      // design has nothing running here, and this is a no-op for it.
      cancelBrowserRun(entry.id)
      upsertEntry({
        id: entry.id,
        status: 'cancelled',
        error: {
          code: 'cancelled',
          message: copy.cancelledMessage,
          retriable: true,
        },
      })
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
      onClear={clearHistory}
      emptyMessage={copy.empty}
      menuAriaLabel={copy.menuAria}
      renderItem={(entry) => {
        const isError =
          entry.status === 'failed' || entry.status === 'cancelled'
        const progress = progressById[entry.id]
        const runningInCloud = entry.status === 'running' && !!entry.cloudId
        const subline = runningInCloud
          ? // No live progress from the cloud: an estimate from the length.
            cloudCopy.recentSubline(estimateCloudSeconds(entry.sequenceLength))
          : entry.status === 'running'
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
              {runningInCloud && <Cloud className="mt-0.5 flex-shrink-0" />}
              {entry.status === 'running' && !runningInCloud && (
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

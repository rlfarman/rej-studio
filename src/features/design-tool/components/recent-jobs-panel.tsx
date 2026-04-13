'use client'
import { useState } from 'react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  useJobHistory,
  type JobHistoryEntry,
} from '@/features/design-tool/hooks/use-job-history'
import { cancelJob as cancelJobAction } from '@/features/design-tool/api/jobs'
import { Button } from '@/components/ui/button'
import { TruncatedText } from '@/components/truncated-text'
import { Loader2, CircleAlert, X } from 'lucide-react'

const COLLAPSED_COUNT = 3
const EXPANDED_MAX = 15

function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  )
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
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
  const [expanded, setExpanded] = useState(false)

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
          message: 'Cancelled',
          retriable: true,
        },
      })
      void cancelJobAction(entry.id).catch(() => {})
    } else {
      removeEntry(entry.id)
    }
  }

  const hiddenCount = entries.length - COLLAPSED_COUNT
  const visibleItems = expanded
    ? entries.slice(0, EXPANDED_MAX)
    : entries.slice(0, COLLAPSED_COUNT)

  return (
    <SidebarGroup>
      <div className="bg-sidebar sticky top-0 z-10 flex items-center justify-between">
        <SidebarGroupLabel>Recent Jobs</SidebarGroupLabel>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="text-xs"
          >
            Clear
          </Button>
        )}
      </div>
      <SidebarGroupContent>
        {entries.length > 0 ? (
          <>
            <SidebarMenu>
              {visibleItems.map((entry) => (
                <SidebarMenuItem key={entry.id}>
                  <SidebarMenuButton onClick={() => onSelectJob?.(entry)}>
                    {entry.status === 'running' && (
                      <Loader2 className="size-3 flex-shrink-0 animate-spin" />
                    )}
                    {(entry.status === 'failed' ||
                      entry.status === 'cancelled') && (
                      <CircleAlert className="text-destructive size-3 flex-shrink-0" />
                    )}
                    <TruncatedText
                      tooltip={
                        (entry.status === 'failed' ||
                          entry.status === 'cancelled') &&
                        entry.error
                          ? entry.error.message
                          : entry.name
                      }
                      className="truncate text-xs"
                    >
                      {entry.name}
                    </TruncatedText>
                    <span className="text-muted-foreground ml-auto flex-shrink-0 text-[10px]">
                      {entry.status === 'running'
                        ? (entry.stage ??
                          (entry.progress !== undefined
                            ? `${Math.round(entry.progress * 100)}%`
                            : 'running'))
                        : formatTimeAgo(entry.createdAt)}
                    </span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    onClick={() => handleRemove(entry)}
                    aria-label={
                      entry.status === 'running'
                        ? `Cancel ${entry.name}`
                        : `Remove ${entry.name} from recent jobs`
                    }
                    className="bg-sidebar hover:bg-sidebar-accent"
                  >
                    <X />
                  </SidebarMenuAction>
                </SidebarMenuItem>
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
            Your completed optimization jobs will appear here.
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

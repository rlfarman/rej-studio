'use client'
import { useState } from 'react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useJobHistory, type JobHistoryEntry } from '@/hooks/use-job-history'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Button } from '@/components/ui/button'

const COLLAPSED_COUNT = 5
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

function formatBp(length: number): string {
  if (length >= 1000) return `${(length / 1000).toFixed(1)}kb`
  return `${length}bp`
}

interface RecentJobsProps {
  onSelectJob?: (entry: JobHistoryEntry) => void
}

export function RecentJobs({ onSelectJob }: RecentJobsProps) {
  const { entries, clearHistory } = useJobHistory()
  const [expanded, setExpanded] = useState(false)

  const hiddenCount = entries.length - COLLAPSED_COUNT
  const visibleItems = expanded
    ? entries.slice(0, EXPANDED_MAX)
    : entries.slice(0, COLLAPSED_COUNT)

  return (
    <SidebarGroup>
      <div className="flex items-center justify-between">
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
            <SidebarMenu
              className={
                expanded ? 'max-h-80 overflow-y-auto' : undefined
              }
            >
              {visibleItems.map((entry) => (
                <SidebarMenuItem key={entry.id}>
                  <SidebarMenuButton onClick={() => onSelectJob?.(entry)}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="inline-block w-16 flex-shrink-0 truncate text-center font-mono"
                        >
                          {entry.id}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatBp(entry.sequenceLength)}
                      </TooltipContent>
                    </Tooltip>
                    <span className="truncate text-xs">{entry.name}</span>
                    <span className="text-muted-foreground ml-auto flex-shrink-0 text-[10px]">
                      {formatTimeAgo(entry.createdAt)}
                    </span>
                  </SidebarMenuButton>
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
                {expanded
                  ? 'Show less'
                  : `+ Show ${hiddenCount} more`}
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

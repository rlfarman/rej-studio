import { useQuery } from '@tanstack/react-query'
import { CircleAlert, Cloud, Loader2 } from 'lucide-react'

import { ExpandableSidebarList } from '@/components/expandable-sidebar-list'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useAccount } from '@/lib/account/account'
import { myCloudDesignsQuery } from '../api/cloud-designs'
import { useJobHistory } from '../hooks/use-job-history'
import { formatTimeAgo } from '../utils/time-ago'
import {
  CLOUD_DESIGN_ERROR_RETENTION_DAYS,
  CLOUD_DESIGN_RETENTION_DAYS,
  type CloudDesignSummary,
} from '../types/cloud-design'
import { designToolCopy } from '../copy'

const copy = designToolCopy.cloud.myDesigns

/**
 * How long this design is kept, in days, or null when it has no outcome to
 * count from: retention runs from the moment a run settles (AGENTS.md,
 * "Cloud designs"), so a queued or running design — or one whose state the
 * index never recorded — gets no claim.
 */
function keptDays(status: CloudDesignSummary['status']): number | null {
  if (status === 'completed') return CLOUD_DESIGN_RETENTION_DAYS
  if (status === 'failed') return CLOUD_DESIGN_ERROR_RETENTION_DAYS
  return null
}

/** Recent designs' own glyphs, for the same three states. */
function statusIcon(status: CloudDesignSummary['status']) {
  if (status === 'queued' || status === 'running') {
    return <Loader2 className="mt-0.5 flex-shrink-0 animate-spin" />
  }
  if (status === 'failed') {
    return <CircleAlert className="mt-0.5 flex-shrink-0 text-destructive" />
  }
  return <Cloud className="mt-0.5 flex-shrink-0" />
}

interface MyCloudDesignsProps {
  onSelect: (id: string) => void
}

/**
 * "My cloud designs", for a signed-in account: its cloud designs from every
 * device, less the ones this browser's own history already lists. Opening
 * one reads it from the cloud into this browser's history (the design
 * tool's `?job=`), after which it shows under Recent designs instead, so the
 * two lists never show a design twice.
 *
 * Each entry says where its design got to, from the status the account's
 * index carries (src/server/designs/records.ts): without it the list could
 * not tell a finished design from one still running, and reading the state
 * per entry would be one Workflow call per row. The icons are Recent
 * designs' (`recent-jobs-panel.tsx`): a spinner while it runs, the
 * destructive alert for a failure, the cloud otherwise.
 */
export function MyCloudDesigns({ onSelect }: MyCloudDesignsProps) {
  const account = useAccount()
  const signedIn = account.status === 'signed-in'
  const { data } = useQuery({ ...myCloudDesignsQuery, enabled: signedIn })
  const entries = useJobHistory((s) => s.entries)

  if (!signedIn || !data) return null
  const here = new Set(entries.map((entry) => entry.cloudId ?? entry.id))
  const elsewhere = data.filter((design) => !here.has(design.id))
  if (elsewhere.length === 0) return null

  return (
    <ExpandableSidebarList
      label={copy.label}
      persistKey="sidebar:my-cloud-designs:open"
      items={elsewhere}
      getItemKey={(design) => design.id}
      menuAriaLabel={copy.menuAria}
      renderItem={(design: CloudDesignSummary) => (
        <SidebarMenuItem>
          <SidebarMenuButton
            size="sm"
            className="h-auto items-start py-1.5 [&>svg]:size-3"
            onClick={() => onSelect(design.id)}
          >
            {statusIcon(design.status)}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
              <span className="line-clamp-2 font-medium">{design.name}</span>
              <span className="block type-nano text-muted-foreground group-hover/menu-button:text-sidebar-accent-foreground">
                {copy.subline(
                  copy.state[design.status ?? 'unknown'],
                  design.bases,
                  formatTimeAgo(design.submittedAt),
                  keptDays(design.status),
                )}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
    />
  )
}

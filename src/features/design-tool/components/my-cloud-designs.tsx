import { useQuery } from '@tanstack/react-query'
import { Cloud } from 'lucide-react'

import { ExpandableSidebarList } from '@/components/expandable-sidebar-list'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useAccount } from '@/lib/account/account'
import { myCloudDesignsQuery } from '../api/cloud-designs'
import { useJobHistory } from '../hooks/use-job-history'
import type { CloudDesignSummary } from '../types/cloud-design'
import { designToolCopy } from '../copy'

const copy = designToolCopy.cloud.myDesigns

interface MyCloudDesignsProps {
  onSelect: (id: string) => void
}

/**
 * "My cloud designs", for a signed-in account: its cloud designs from every
 * device, less the ones this browser's own history already lists. Opening
 * one reads it from the cloud into this browser's history (the design
 * tool's `?job=`), after which it shows under Recent jobs instead, so the
 * two lists never show a design twice.
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
            <Cloud className="mt-0.5 flex-shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
              <span className="line-clamp-2 font-medium">{design.name}</span>
              <span className="block type-nano text-muted-foreground group-hover/menu-button:text-sidebar-accent-foreground">
                {copy.subline(design.bases)}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
    />
  )
}

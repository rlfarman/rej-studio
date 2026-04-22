'use client'

import { useToggleSidebar } from '@/components/ui/sidebar'
import { useSidebarStore, selectSidebarState } from '@/stores/sidebar-store'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

export function SidebarToggle() {
  const toggleSidebar = useToggleSidebar()
  const state = useSidebarStore(selectSidebarState)
  const isCollapsed = state === 'collapsed'
  const label = isCollapsed ? 'Open sidebar' : 'Close sidebar'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label={label}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

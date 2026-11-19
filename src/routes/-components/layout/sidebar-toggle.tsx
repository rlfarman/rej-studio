import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Kbd, ModKey } from '@/components/ui/kbd'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { commonCopy } from '@/copy/common'

/**
 * The header's sidebar button. On phones the sidebar is a sheet with its own
 * open state, so the label has to read that one — built from the desktop
 * state it said "Close sidebar" while the sheet was shut. `aria-expanded`
 * comes from the primitive, which knows the same state.
 */
export function SidebarToggle() {
  const { state, isMobile, openMobile } = useSidebar()
  const expanded = isMobile ? openMobile : state === 'expanded'
  const label = expanded ? commonCopy.sidebar.close : commonCopy.sidebar.open

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <SidebarTrigger
            aria-label={label}
            // The sidebar primitive's ⌘B / Ctrl+B.
            aria-keyshortcuts="Meta+B Control+B"
          />
        }
      />
      <TooltipContent>
        {label}
        <Kbd aria-hidden>
          <ModKey /> B
        </Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

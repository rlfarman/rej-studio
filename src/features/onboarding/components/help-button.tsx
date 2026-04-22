'use client'

import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useOnboarding } from '../stores/onboarding-store'

export function HelpButton() {
  const openWelcome = useOnboarding((s) => s.openWelcome)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={openWelcome}
          aria-label="Open help and tour"
          className="bg-background fixed right-4 bottom-4 z-40 size-10 rounded-full shadow-md"
        >
          <HelpCircle className="size-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Help &amp; tour</TooltipContent>
    </Tooltip>
  )
}

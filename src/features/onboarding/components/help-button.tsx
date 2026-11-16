'use client'

import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useOnboarding } from '../stores/onboarding-store'
import { onboardingCopy } from '../copy'

const copy = onboardingCopy.helpButton

/**
 * Help & tour entry point, rendered in the app header. It used to float in
 * the bottom-right corner, where it covered table row menus and mobile
 * content.
 */
export function HeaderHelpButton() {
  const openWelcome = useOnboarding((s) => s.openWelcome)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={openWelcome}
          aria-label={copy.label}
        >
          <HelpCircle className="size-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{copy.tooltip}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The old floating button, still mounted by src/app/(app)/layout.tsx.
 * Help now lives in the header (HeaderHelpButton), so this renders nothing.
 * Remove it and its <HelpButton /> in the layout once that file can change.
 */
export function HelpButton() {
  return null
}

'use client'

import { CircleHelp } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface FieldHelpProps {
  /** Short name of the thing being explained, used for the accessible label. */
  topic: string
  /** One or two sentences. Plain language — this is the only explanation. */
  children: string
  className?: string
}

/**
 * Inline explanation for a domain term (WGGW, CpG, k-mer …).
 *
 * A real `<button>` rather than an icon with a title attribute, so it's
 * reachable by keyboard and announced by screen readers. The design tool's
 * terms have no docs page to link to (docs are hidden), so the explanation
 * lives in the tooltip itself.
 */
export function FieldHelp({ topic, children, className }: FieldHelpProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`What is ${topic}?`}
            // Inside a <label>, a click would otherwise toggle the checkbox.
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            className={cn(
              'text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
              className,
            )}
          >
            <CircleHelp className="size-3.5" aria-hidden />
          </button>
        }
      />
      <TooltipContent side="top" sideOffset={4} className="max-w-xs">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

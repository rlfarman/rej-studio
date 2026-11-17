import { useState } from 'react'
import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface TermHintProps {
  /** Accessible name, e.g. "What is WGGW?" */
  label: string
  hint: string
  className?: string
}

/**
 * "What is this?" affordance for domain terms. Radix tooltips open on hover
 * and keyboard focus but ignore taps, so the tooltip is controlled here and
 * also toggles on click. Radix closes it on Escape, blur, and outside taps.
 */
export function TermHint({ label, hint, className }: TermHintProps) {
  const [open, setOpen] = useState(false)

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            // Radix closes the tooltip on trigger pointerdown/click; prevent
            // that so a tap can open it. Stop propagation so the click doesn't
            // also sort a column or expand a table row.
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen((o) => !o)
            }}
            className={cn(
              'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              className,
            )}
          >
            <Info className="size-3.5" aria-hidden="true" />
          </button>
        }
      />
      <TooltipContent className="max-w-64 text-left leading-snug text-balance">
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}

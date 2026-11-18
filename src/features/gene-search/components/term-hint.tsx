import { Info } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface TermHintProps {
  /** Accessible name, e.g. "What is WGGW?" */
  label: string
  hint: string
  className?: string
}

/**
 * "What is this?" affordance for domain terms: an infotip. Base UI's
 * guidance is a Popover that also opens on hover, not a Tooltip: tooltips
 * are disabled on touch devices and hidden from assistive technology, while
 * a popover opens on hover, focus-and-Enter, click or tap, and closes on
 * Escape or an outside press.
 */
export function TermHint({ label, hint, className }: TermHintProps) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        render={
          <button
            type="button"
            aria-label={label}
            // Inside sortable headers and expandable rows: opening the hint
            // must not also sort a column or expand the row.
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              className,
            )}
          >
            <Info className="size-3.5" aria-hidden="true" />
          </button>
        }
      />
      <PopoverContent
        side="top"
        className="w-auto max-w-64 rounded-2xl p-3 text-left leading-snug text-balance"
      >
        {hint}
      </PopoverContent>
    </Popover>
  )
}

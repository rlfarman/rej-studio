import { Info } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { commonCopy } from '@/copy/common'
import { cn } from '@/lib/utils'

interface TermHintProps {
  /**
   * Short name of the thing being explained (e.g. "WGGW", "CpG",
   * "Split point"). The accessible name is built from it.
   */
  topic: string
  /** One or two sentences in plain language — this is the only explanation. */
  hint: string
  className?: string
}

/**
 * "What is this?" affordance for a domain term: an infotip.
 *
 * A Popover, not a Tooltip, and the reason is load-bearing: Base UI disables
 * tooltips on touch devices, so every one of these terms — WGGW, CpG, k-mer,
 * the stimulatory introns, the split point — was simply unexplained on a
 * phone or tablet. These terms have no docs page to link to, so the
 * explanation lives here and nowhere else. A popover opens on hover, on
 * focus-and-Enter, and on tap, and closes on Escape or an outside press.
 *
 * The trigger draws at 24px so it sits on a line of text, and a
 * pseudo-element stretches its hit area to the 44px touch minimum at no
 * cost in layout — the same way `checkbox.tsx` and the sidebar's controls
 * do it. The icon is small; the thing you tap is not.
 */
export function TermHint({ topic, hint, className }: TermHintProps) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        render={
          <button
            type="button"
            aria-label={commonCopy.termHintAria(topic)}
            // These sit inside sortable table headers, expandable rows and
            // checkbox labels: opening the hint must not also sort a column,
            // expand a row or toggle the checkbox.
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors before:absolute before:-inset-2.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
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

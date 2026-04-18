'use client'

// Stage chips that fill as optimization progresses. Each chip is tied to a
// fraction threshold; when `frac` crosses the threshold, the chip fills with
// a spring-ish transition. Honest approximation of the real progress —
// backend doesn't emit per-constraint events, so we key off `frac` only.

import { m, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { softSpring } from '@/lib/motion'

export interface RunChip {
  label: string
  /** 0..1 fraction at which this chip becomes "done". */
  threshold: number
}

interface RunChipsProps {
  chips: RunChip[]
  frac: number
  className?: string
}

export function RunChips({ chips, frac, className }: RunChipsProps) {
  const reduce = useReducedMotion()
  return (
    <ul
      className={cn('flex flex-wrap gap-1.5', className)}
      aria-label="Optimization steps"
    >
      {chips.map((chip, i) => {
        const done = frac >= chip.threshold
        // The currently-active chip is the first undone chip, or the last
        // chip if all are done.
        const firstUndone = chips.findIndex((c) => frac < c.threshold)
        const active =
          i === (firstUndone === -1 ? chips.length - 1 : firstUndone)

        return (
          <li key={chip.label}>
            <m.div
              layout={!reduce}
              transition={reduce ? { duration: 0 } : softSpring}
              className={cn(
                'relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                done
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : active
                    ? 'border-border bg-background text-foreground'
                    : 'border-border/70 bg-muted/40 text-muted-foreground',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {/* Fill wash: scales from the left as frac approaches threshold. */}
              <m.span
                aria-hidden
                className="bg-primary/10 absolute inset-0 origin-left"
                initial={false}
                animate={{
                  scaleX: done
                    ? 1
                    : Math.max(0, Math.min(1, frac / chip.threshold)),
                }}
                transition={
                  reduce ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }
                }
              />
              <span className="relative flex size-3 shrink-0 items-center justify-center">
                {done ? (
                  <m.span
                    key="check"
                    initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={reduce ? { duration: 0 } : softSpring}
                    className="inline-flex"
                  >
                    <Check className="size-3" />
                  </m.span>
                ) : active ? (
                  <span
                    aria-hidden
                    className="bg-primary size-1.5 animate-pulse rounded-full"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="border-border size-1.5 rounded-full border"
                  />
                )}
              </span>
              <span className="relative">{chip.label}</span>
            </m.div>
          </li>
        )
      })}
    </ul>
  )
}

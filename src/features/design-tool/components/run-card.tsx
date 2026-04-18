'use client'

// Cinematic run surface. Replaces the plain RunningPlaceholder when a job
// is in flight. Presents a live DNA ribbon, stage chips that fill as `frac`
// advances, and an elapsed counter — connected to the submit button and
// results card via a shared view-transition-name so the surface morphs
// rather than dissolves.

import { useEffect, useRef, useState } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DnaRibbon } from './dna-ribbon'
import { RunChips, type RunChip } from './run-chips'
import { MetricCounter } from './metric-counter'
import { fadeUp } from '@/lib/motion'
import { designToolCopy } from '../copy'

const copy = designToolCopy.jobHeader.running
const submitCopy = designToolCopy.submit

// Stages map to real progress fractions emitted by the backend heartbeat.
// The thresholds roughly align with DNAChisel's phase boundaries in
// python/algorithm.py: resolve (0.15–0.40), optimize (0.45–0.88), finalize.
const RUN_CHIPS: RunChip[] = [
  { label: submitCopy.stageCodons.replace(/…/, ''), threshold: 0.2 },
  { label: submitCopy.stageSplit.replace(/…/, ''), threshold: 0.5 },
  { label: submitCopy.stageWggw.replace(/…/, ''), threshold: 0.85 },
  { label: submitCopy.stageGenerate.replace(/…/, ''), threshold: 0.95 },
]

interface RunCardProps {
  name: string
  sequenceLength: number
  frac: number | undefined
  stage: string | undefined
  onCancel?: () => void
  /** view-transition-name shared with the submit button + results card. */
  viewTransitionName?: string
}

export function RunCard({
  name,
  sequenceLength,
  frac,
  stage,
  onCancel,
  viewTransitionName = 'rej-job-surface',
}: RunCardProps) {
  const reduce = useReducedMotion()
  const effectiveFrac =
    typeof frac === 'number' ? Math.max(0, Math.min(1, frac)) : 0
  const pct = Math.round(effectiveFrac * 100)
  const elapsed = useElapsed()

  return (
    <m.div
      variants={fadeUp}
      initial={reduce ? false : 'hidden'}
      animate="visible"
      style={{ viewTransitionName }}
    >
      <Card
        role="status"
        aria-live="polite"
        aria-label={copy.title}
        className={cn(
          'relative overflow-hidden',
          // Subtle ambient glow behind the surface — scales with progress so
          // the card "warms up" as the job proceeds. Kept low-alpha; calm.
        )}
      >
        {/* Ambient glow tied to frac. Hidden for reduced-motion. */}
        {!reduce && (
          <div
            aria-hidden
            className="from-primary/[0.06] pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent transition-opacity duration-700"
            style={{ opacity: 0.3 + effectiveFrac * 0.7 }}
          />
        )}
        <CardContent className="relative space-y-5 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {copy.title}
              </p>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h2 className="truncate text-base font-semibold">
                  {name || 'Untitled'}
                </h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  · {sequenceLength.toLocaleString()} bp
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-2xl leading-none font-semibold">
                <MetricCounter value={pct} suffix="%" />
              </div>
              <div className="text-muted-foreground mt-1 text-[10px] tabular-nums">
                {formatElapsed(elapsed)}
              </div>
            </div>
          </div>

          <DnaRibbon
            frac={effectiveFrac}
            sequenceLength={sequenceLength}
            viewTransitionName={`${viewTransitionName}-ribbon`}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {stage ?? copy.defaultStage}
            </p>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
          </div>

          <RunChips chips={RUN_CHIPS} frac={effectiveFrac} />
        </CardContent>
      </Card>
    </m.div>
  )
}

function useElapsed() {
  // `null` until the effect initializes — keeps `performance.now()` (impure)
  // out of the render path.
  const startedRef = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    startedRef.current = performance.now()
    let raf = 0
    const tick = () => {
      if (startedRef.current !== null) {
        setElapsed(performance.now() - startedRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return elapsed
}

function formatElapsed(ms: number): string {
  const total = ms / 1000
  if (total < 60) return `${total.toFixed(1)}s`
  const min = Math.floor(total / 60)
  const sec = Math.floor(total % 60)
  return `${min}m ${sec.toString().padStart(2, '0')}s`
}

'use client'

import * as React from 'react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { softSpring } from '@/lib/motion'
import { designToolCopy } from '../copy'
import type { RunMetrics, RunObjective } from '../types/run-metrics'
import { DnaRibbon } from './dna-ribbon'
import { RunningPlaceholder } from './job-header'

const copy = designToolCopy.runCard

interface RunCardProps {
  name: string
  sequence: string
  sequenceLength: number
  stage?: string
  progress?: number
  metrics?: RunMetrics
  onCancel?: () => void
}

/** Smoothly tween a numeric readout toward `target`, settling with a spring
 * feel via critically-damped exponential easing. Avoids motion's value layer
 * so the surrounding text node can be a plain `<span>` (no extra wrappers). */
function useEasedNumber(target: number | null | undefined, halfLifeMs = 320) {
  const [displayed, setDisplayed] = useState<number | null>(target ?? null)
  const targetRef = useRef<number | null>(target ?? null)
  const reduced = useReducedMotion()

  useEffect(() => {
    targetRef.current = target ?? null
    if (target == null) {
      setDisplayed(null)
      return
    }
    if (reduced) {
      setDisplayed(target)
      return
    }
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.max(0.001, (now - last) / 1000)
      last = now
      setDisplayed((prev) => {
        const t = targetRef.current
        if (t == null) return null
        if (prev == null) return t
        const lambda = Math.LN2 / (halfLifeMs / 1000)
        const next = prev + (t - prev) * (1 - Math.exp(-lambda * dt))
        return Math.abs(next - t) < 0.005 ? t : next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, halfLifeMs])

  return displayed
}

interface SyntheticState {
  progress: number
  stage: string
  iteration: number
}

/** Local-backend (and pre-first-poll) fallback: synthesize a believable
 * progress curve so the run card feels alive even when the backend isn't
 * surfacing metrics yet. The curve asymptotes — it never hits 100 from
 * synthetic data alone. Real progress overrides as soon as it arrives. */
function useSyntheticProgress(active: boolean): SyntheticState {
  const [state, dispatch] = useReducer(
    (s: SyntheticState, t: number) => {
      // Map elapsed seconds → asymptotic progress (saturates ~88%).
      const progress = 0.88 * (1 - Math.exp(-t / 8))
      let stage: string = designToolCopy.jobHeader.running.defaultStage
      if (t > 1.5) stage = designToolCopy.submit.stageCodons.replace(/…$/, '')
      if (t > 5) stage = designToolCopy.submit.stageSplit.replace(/…$/, '')
      if (t > 9) stage = designToolCopy.submit.stageWggw.replace(/…$/, '')
      if (t > 13) stage = designToolCopy.submit.stageGenerate.replace(/…$/, '')
      return { progress, stage, iteration: Math.round(t * 47) }
    },
    { progress: 0, stage: copy.defaultStage, iteration: 0 },
  )

  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const id = setInterval(
      () => dispatch((performance.now() - start) / 1000),
      250,
    )
    return () => clearInterval(id)
  }, [active])

  return state
}

function MetricCell({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
        {label}
      </span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
}

function ObjectiveChips({
  objectives,
  passingCount,
}: {
  objectives: RunObjective[]
  passingCount: number
}) {
  return (
    <ul className="flex flex-wrap gap-1.5" role="list">
      {objectives.map((obj, i) => {
        const done = obj.done || i < passingCount
        return (
          <m.li
            key={`${obj.name}-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...softSpring, delay: i * 0.04 }}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
              done
                ? 'border-[oklch(0.82_0.14_125_/_0.5)] bg-[oklch(0.82_0.14_125_/_0.18)] text-[oklch(0.4_0.1_135)] dark:text-[oklch(0.85_0.15_130)]'
                : 'border-border/60 bg-muted/40 text-muted-foreground',
            )}
            aria-label={`${obj.name}: ${done ? copy.objectiveDone : copy.objectivePending}`}
          >
            {prettifyObjectiveName(obj.name)}
          </m.li>
        )
      })}
    </ul>
  )
}

/** dnachisel objective reprs look like `AvoidPattern[CG](0..2400)` —
 * trim them to the bare spec name so chips read cleanly. */
function prettifyObjectiveName(raw: string): string {
  const head = raw.split('(')[0]
  const noBracket = head.split('[')[0]
  // Insert spaces before capitals (CodonOptimize → Codon Optimize).
  return noBracket
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
}

function ScoreDial({ score }: { score: number | null | undefined }) {
  const eased = useEasedNumber(score ?? null, 380)
  if (eased == null) {
    return (
      <span className="text-sm font-medium tabular-nums">
        {copy.pendingValue}
      </span>
    )
  }
  return (
    <span className="text-sm font-medium tabular-nums">{eased.toFixed(1)}</span>
  )
}

function ObjectivesRing({
  passing,
  total,
}: {
  passing: number
  total: number
}) {
  const eased = useEasedNumber(total > 0 ? passing : 0, 320)
  if (total <= 0) return null
  const ratio = Math.min(1, Math.max(0, (eased ?? 0) / total))
  const radius = 14
  const circ = 2 * Math.PI * radius
  return (
    <div className="relative size-9 shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-border/70"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ratio)}
          className="text-[oklch(0.78_0.16_130)]"
          style={{
            transition: 'stroke-dashoffset 600ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums">
        {Math.round(eased ?? 0)}/{total}
      </span>
    </div>
  )
}

export function RunCard({
  name,
  sequence,
  sequenceLength,
  stage,
  progress,
  metrics,
  onCancel,
}: RunCardProps) {
  const reducedMotion = useReducedMotion() ?? false
  // Synthesize when no real progress has landed yet (local backend, or the
  // first ~750ms before the first Modal poll returns).
  const needsSynthetic = progress == null && metrics == null
  const synthetic = useSyntheticProgress(needsSynthetic)

  const effectiveProgress =
    progress ?? (needsSynthetic ? synthetic.progress : 0)
  const effectiveStage =
    stage ?? (needsSynthetic ? synthetic.stage : copy.defaultStage)

  const easedProgress = useEasedNumber(effectiveProgress, 240) ?? 0
  const easedGc = useEasedNumber(metrics?.gcPercent ?? null, 260)
  const easedCpg = useEasedNumber(metrics?.cpgCount ?? null, 260)
  const iterationDisplay =
    metrics?.iteration ?? (needsSynthetic ? synthetic.iteration : null)

  const progressPct = Math.round(Math.min(1, Math.max(0, easedProgress)) * 100)
  const objectives = metrics?.objectives ?? []
  const passing = metrics?.objectivesPassing ?? 0
  const total = metrics?.objectivesTotal ?? objectives.length

  // Reduced-motion path: keep the existing calm placeholder + score readout,
  // so the canvas + chip choreography never animates against the user's
  // stated preference. The data is still shown — just statically.
  if (reducedMotion) {
    return (
      <div style={{ viewTransitionName: 'designtool-active-surface' }}>
        <RunningPlaceholder
          stage={effectiveStage}
          progress={effectiveProgress}
        />
      </div>
    )
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ viewTransitionName: 'designtool-active-surface' }}
    >
      <Card>
        <CardContent
          role="status"
          aria-live="polite"
          aria-label={copy.ariaLabel}
          className="flex flex-col gap-4 py-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {total > 0 ? (
                <ObjectivesRing passing={passing} total={total} />
              ) : (
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                  <PulseDot />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {name || designToolCopy.jobHeader.untitled} ·{' '}
                  <span className="text-muted-foreground tabular-nums">
                    {sequenceLength.toLocaleString()} bp
                  </span>
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {effectiveStage}
                </p>
              </div>
            </div>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                {copy.cancelLabel}
              </Button>
            )}
          </div>

          {sequence ? (
            <DnaRibbon
              sequence={sequence}
              mutationHint={metrics?.mutationHint}
              progress={effectiveProgress}
              reducedMotion={false}
            />
          ) : null}

          <div className="bg-muted relative h-1 w-full overflow-hidden rounded-full">
            <div
              className="absolute inset-y-0 left-0 w-full origin-left bg-[oklch(0.78_0.16_130)] transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${easedProgress})` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <MetricCell
              label={copy.metricScore}
              value={
                metrics?.score == null ? (
                  copy.pendingValue
                ) : (
                  <ScoreDial score={metrics.score} />
                )
              }
            />
            <MetricCell
              label={copy.metricGc}
              value={
                easedGc == null ? copy.pendingValue : `${easedGc.toFixed(1)}%`
              }
            />
            <MetricCell
              label={copy.metricCpg}
              value={
                easedCpg == null
                  ? copy.pendingValue
                  : Math.round(easedCpg).toLocaleString()
              }
            />
            <MetricCell
              label={copy.metricIteration}
              value={
                iterationDisplay == null
                  ? `${progressPct}%`
                  : iterationDisplay.toLocaleString()
              }
            />
          </div>

          {objectives.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
                  {copy.objectivesHeading}
                </span>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {copy.objectivesProgress(passing, total)}
                </span>
              </div>
              <ObjectiveChips objectives={objectives} passingCount={passing} />
            </div>
          )}
        </CardContent>
      </Card>
    </m.div>
  )
}

/** Tiny breathing dot used as the leading indicator before the objectives
 * ring has data. Calm pulse, not a spinner — running but not anxious. */
function PulseDot() {
  return (
    <m.span
      animate={{ opacity: [0.55, 1, 0.55], scale: [0.92, 1, 0.92] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      className="bg-primary block size-2 rounded-full"
    />
  )
}

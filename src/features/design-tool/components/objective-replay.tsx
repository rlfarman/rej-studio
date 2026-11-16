'use client'

import type React from 'react'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ObjectivesReport } from '@/features/design-tool/types/process-result'
import {
  buildObjectiveSteps,
  countOutcomes,
  isNotable,
  type ObjectiveOutcome,
  type ObjectiveStep,
} from '@/features/design-tool/utils/objective-steps'
import { cn } from '@/lib/utils'

import { designToolCopy } from '../copy'

const copy = designToolCopy.results.replay

interface ObjectiveReplayProps {
  reportBefore: ObjectivesReport
  reportAfter: ObjectivesReport
  /** Length of the final sequence, so flagged regions can be placed on it. */
  sequenceLength: number
}

const OUTCOME_STYLES: Record<ObjectiveOutcome, string> = {
  fixed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  broken: 'bg-red-500/15 text-red-700 dark:text-red-300',
  unresolved: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  added: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  held: 'bg-muted text-muted-foreground',
  dropped: 'bg-muted text-muted-foreground',
}

/**
 * Where an objective was unhappy, along the sequence.
 *
 * The regions come from the report; nothing is inferred about what lies
 * between them. An objective with no regions draws an empty track rather than
 * a full one, because "nothing flagged" and "flagged everywhere" must not look
 * alike.
 */
function RegionTrack({
  label,
  regions,
  sequenceLength,
  tone,
}: {
  label: string
  regions: { start: number; end: number }[]
  sequenceLength: number
  tone: 'before' | 'after'
}) {
  const span = Math.max(1, sequenceLength)
  const description =
    regions.length === 0
      ? copy.track.none(label)
      : copy.track.regions(label, regions.length)

  return (
    <div>
      <div className="text-muted-foreground mb-1 flex items-baseline justify-between text-xs">
        <span>{label}</span>
        <span>{copy.track.count(regions.length)}</span>
      </div>
      <div
        className="bg-muted relative h-3 w-full overflow-hidden rounded-sm"
        role="img"
        aria-label={description}
      >
        {regions.map((region, index) => {
          const start = Math.max(0, Math.min(region.start, span))
          const end = Math.max(start + 1, Math.min(region.end, span))
          return (
            <span
              key={`${region.start}-${region.end}-${index}`}
              className={cn(
                'absolute inset-y-0',
                tone === 'before' ? 'bg-amber-500/70' : 'bg-sky-500/70',
              )}
              style={{
                left: `${(start / span) * 100}%`,
                width: `${Math.max(0.4, ((end - start) / span) * 100)}%`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * What the optimizer changed, one objective at a time.
 *
 * The results panel already shows the two reports side by side, which answers
 * "what is the state of things". This answers "what happened": step through
 * the objectives that moved, and for each see what it flagged before and what
 * it flags now, in the same places along the sequence.
 *
 * It is a view over data the result already carries. There is no record of the
 * order the optimizer worked in, so this does not pretend to replay the run;
 * it walks the objectives, and says so.
 */
export function ObjectiveReplay({
  reportBefore,
  reportAfter,
  sequenceLength,
}: ObjectiveReplayProps) {
  const allSteps = useMemo(
    () => buildObjectiveSteps(reportBefore, reportAfter),
    [reportBefore, reportAfter],
  )
  const notable = useMemo(() => allSteps.filter(isNotable), [allSteps])
  const counts = useMemo(() => countOutcomes(allSteps), [allSteps])

  const [showAll, setShowAll] = useState(false)
  const [index, setIndex] = useState(0)

  const steps: ObjectiveStep[] = showAll ? allSteps : notable
  // The lists differ in length, so an index from one may not exist in the other.
  const position = Math.min(index, Math.max(0, steps.length - 1))
  const step = steps[position]

  if (allSteps.length === 0) {
    return <p className="text-muted-foreground text-sm">{copy.noReport}</p>
  }
  // The backend evaluates the final sequence separately and swallows a failure
  // there, which leaves a run with a first report and no second one. Every
  // objective then looks "dropped", which must not be read as "all held".
  if (reportAfter.entries.length === 0) {
    return <p className="text-muted-foreground text-sm">{copy.noFinalReport}</p>
  }
  if (reportBefore.entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{copy.noInitialReport}</p>
    )
  }
  if (!step) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">{copy.nothingChanged}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAll(true)}>
          {copy.showAll}
        </Button>
      </div>
    )
  }

  const go = (delta: number) => {
    setIndex((current) =>
      Math.min(steps.length - 1, Math.max(0, current + delta)),
    )
  }

  /**
   * Left and right move between objectives while either control has focus, so
   * the list can be walked without returning to the buttons each time. The
   * handler lives on the buttons because they are the interactive elements;
   * a focusable wrapper would be a trap for a screen-reader user.
   */
  const onArrowKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      go(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      go(-1)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['fixed', 'broken', 'unresolved', 'held'] as const).map((outcome) =>
          counts[outcome] > 0 ? (
            <Badge
              key={outcome}
              variant="secondary"
              className={cn('font-normal', OUTCOME_STYLES[outcome])}
            >
              {copy.outcomes[outcome]}: {counts[outcome]}
            </Badge>
          ) : null,
        )}
      </div>

      <div role="group" aria-label={copy.groupLabel} className="rounded-md">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => go(-1)}
            onKeyDown={onArrowKey}
            disabled={position === 0}
            aria-label={copy.previous}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p
            className="text-muted-foreground text-xs tabular-nums"
            aria-live="polite"
          >
            {copy.position(position + 1, steps.length)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => go(1)}
            onKeyDown={onArrowKey}
            disabled={position >= steps.length - 1}
            aria-label={copy.next}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={cn('font-normal', OUTCOME_STYLES[step.outcome])}
            >
              {copy.outcomes[step.outcome]}
            </Badge>
            <code className="text-xs break-all">{step.objective}</code>
          </div>

          {step.after?.message ? (
            <p className="text-muted-foreground text-sm">{step.after.message}</p>
          ) : step.before?.message ? (
            <p className="text-muted-foreground text-sm">
              {step.before.message}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <RegionTrack
              label={copy.beforeLabel}
              regions={step.before?.locations ?? []}
              sequenceLength={sequenceLength}
              tone="before"
            />
            <RegionTrack
              label={copy.afterLabel}
              regions={step.after?.locations ?? []}
              sequenceLength={sequenceLength}
              tone="after"
            />
          </div>

          {/* The same step as text, for a screen reader and for copying. */}
          <Table>
            <TableCaption className="sr-only">
              {copy.tableCaption(step.objective)}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.headers.report}</TableHead>
                <TableHead>{copy.headers.verdict}</TableHead>
                <TableHead>{copy.headers.score}</TableHead>
                <TableHead>{copy.headers.flagged}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                [
                  [copy.beforeLabel, step.before, step.flaggedBefore],
                  [copy.afterLabel, step.after, step.flaggedAfter],
                ] as const
              ).map(([label, entry, flagged]) => (
                <TableRow key={label}>
                  <TableCell>{label}</TableCell>
                  <TableCell>
                    {entry
                      ? entry.passes
                        ? copy.passed
                        : copy.failed
                      : copy.absent}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {entry ? entry.score.toFixed(2) : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">{flagged}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {!showAll && allSteps.length > notable.length && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setShowAll(true)
            setIndex(0)
          }}
        >
          {copy.showAllWithCount(allSteps.length - notable.length)}
        </Button>
      )}
    </div>
  )
}

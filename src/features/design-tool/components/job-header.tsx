import * as React from 'react'
import { useState } from 'react'
import {
  Loader2,
  Check,
  CircleAlert,
  CircleSlash,
  Cloud,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Trash2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DnaLoader } from '@/components/bio/dna-loader'
import { cn } from '@/lib/utils'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { designToolCopy } from '../copy'

const copy = designToolCopy.jobHeader
const cloudCopy = designToolCopy.cloud

/**
 * Takes focus when the card appears.
 *
 * Starting a run unmounts the form, and with it whatever had focus — a
 * keyboard or screen-reader user was dropped onto `<body>` with nothing
 * said. The card that replaces the form takes focus instead, so the next
 * Tab continues from here and its label is read out.
 */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  React.useEffect(() => {
    ref.current?.focus()
  }, [])
  return ref
}

/**
 * What a cloud design shows while it runs: an estimate from its length, not
 * a progress bar. A Workflow step cannot report progress, and a bar that
 * moved on a timer would claim to know something it does not.
 */
export function CloudRunningPlaceholder({
  bases,
  estimateSeconds,
}: {
  bases: number
  estimateSeconds: number
}) {
  const ref = useFocusOnMount<HTMLDivElement>()
  return (
    <Card>
      <CardContent
        ref={ref}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-label={cloudCopy.running.title}
        className="flex flex-col items-center justify-center gap-4 py-12 focus-visible:outline-none"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Cloud className="size-6" />
        </span>
        <div className="max-w-sm space-y-1 text-center">
          <p className="text-sm font-medium">{cloudCopy.running.title}</p>
          <p className="text-xs text-muted-foreground">
            {cloudCopy.running.body(estimateSeconds, bases)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

interface RunningPlaceholderProps {
  stage?: string
  progress?: number
}

export function RunningPlaceholder({
  stage,
  progress,
}: RunningPlaceholderProps) {
  // The optimizer reports progress as a 0-1 fraction.
  const pct =
    typeof progress === 'number' && progress >= 0 && progress <= 1
      ? Math.round(progress * 100)
      : null
  // Ease toward the target so the bar never feels frozen between ticks, and
  // always advances visibly when a new checkpoint lands.
  const displayedPct = useSmoothedProgress(pct)
  const ref = useFocusOnMount<HTMLDivElement>()
  return (
    <Card>
      {/* Not a live region as a whole: wrapping the smoothed percentage made
          a screen reader read a new number several times a second for the
          whole run. Only the stage announces; the number is a progress bar
          the reader can query. */}
      <CardContent
        ref={ref}
        tabIndex={-1}
        // A named group rather than a bare div: focused, its label is what a
        // screen reader reads out in place of the form that just left.
        role="group"
        aria-label={copy.running.title}
        className="flex flex-col items-center justify-center gap-4 py-12 focus-visible:outline-none"
      >
        <DnaLoader className="h-10 w-[120px]" />
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium">{copy.running.title}</p>
          <p
            role="status"
            aria-live="polite"
            className="h-4 text-xs text-muted-foreground"
          >
            {stage ?? copy.running.defaultStage}
          </p>
        </div>
        <div className="w-full max-w-xs">
          <div
            role="progressbar"
            aria-label={copy.running.progressAria}
            // The last checkpoint the optimizer actually reported, not the
            // eased value the bar draws.
            aria-valuenow={pct ?? undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={
              pct === null ? copy.running.defaultStage : undefined
            }
            className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            {displayedPct !== null ? (
              <div
                className="absolute inset-y-0 left-0 w-full origin-left bg-primary transition-transform duration-700 ease-out"
                style={{ transform: `scaleX(${displayedPct / 100})` }}
              />
            ) : (
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary/70"
              />
            )}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground/25 to-transparent"
            />
          </div>
          {displayedPct !== null && (
            <p
              aria-hidden
              className="mt-1.5 text-center type-micro text-muted-foreground tabular-nums"
            >
              {displayedPct}%
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Eases displayed percentage toward the target. Between progress ticks the
 * real value doesn't move, so we creep forward on an asymptotic curve that
 * caps a few points below the target. When a new tick lands, the
 * displayed value snaps to the new floor and resumes creeping.
 */
function useSmoothedProgress(target: number | null): number | null {
  const [displayed, setDisplayed] = React.useState<number | null>(target)
  const [prevTarget, setPrevTarget] = React.useState(target)
  const targetRef = React.useRef(target)

  // When a new tick lands, snap during render (React's "adjust state when a
  // prop changes" pattern): clear on null, jump up when the target moves past
  // the displayed value. The effect below only runs the creep animation.
  if (target !== prevTarget) {
    setPrevTarget(target)
    setDisplayed(
      target === null
        ? null
        : displayed === null || target > displayed
          ? target
          : displayed,
    )
  }

  React.useEffect(() => {
    targetRef.current = target
    if (target === null) return

    let raf = 0
    let lastTick = performance.now()
    let stopped = false
    const tick = (now: number) => {
      const dt = (now - lastTick) / 1000
      lastTick = now
      setDisplayed((prev) => {
        const t = targetRef.current
        if (t === null || prev === null) return prev
        // Creep up to +10 points above the last real checkpoint, but never
        // reach 100 via creep — real completion is signalled elsewhere.
        const ceiling = Math.min(99, t + 10)
        if (prev >= ceiling) {
          stopped = true
          return prev
        }
        // ~3 points/second, tapered.
        const delta = dt * 3 * (1 - (prev - t) / 10)
        return Math.min(ceiling, prev + delta)
      })
      if (!stopped) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return displayed === null ? null : Math.round(displayed)
}

type JobHeaderStatus = 'running' | 'completed' | 'failed' | 'cancelled'

interface JobHeaderProps {
  name: string
  /** null when there's no local record of this job — the chip is hidden. */
  sequenceLength: number | null
  species: DesignToolSpecies
  status: JobHeaderStatus
  processingTimeSeconds?: number | null
  errorMessage?: string | null
  retriable?: boolean
  onEdit: () => void
  onRerun: () => void
  onCancel?: () => void
  /**
   * There is no record of this design on this device, so there is nothing to
   * edit: the button says what it really does, which is start a new one.
   */
  missing?: boolean
  /** Set for a design that ran in the cloud. */
  cloud?: {
    estimateSeconds: number
    deleted: boolean
    onDelete: () => void
    deleting: boolean
  } | null
}

const SPECIES_LABEL: Record<DesignToolSpecies, string> = copy.speciesLabel

function StatusDot({ status }: { status: JobHeaderStatus }) {
  // Fire a one-shot bloom only on the running → completed transition, not
  // when the component mounts onto an already-completed job (e.g. loading
  // a past job from history). Keyed so the animation restarts cleanly.
  // Tracked during render rather than in an effect, so the bloom starts in
  // the same render as the status change.
  const [prevStatus, setPrevStatus] = useState<JobHeaderStatus>(status)
  const [celebrateKey, setCelebrateKey] = useState(0)
  if (status !== prevStatus) {
    setPrevStatus(status)
    if (prevStatus === 'running' && status === 'completed') {
      setCelebrateKey((k) => k + 1)
    }
  }

  const classes = cn(
    'relative flex size-7 shrink-0 items-center justify-center rounded-full',
    status === 'running' && 'bg-primary/10 text-primary',
    status === 'completed' && 'bg-success/10 text-success-soft',
    status === 'failed' && 'bg-destructive/10 text-destructive',
    status === 'cancelled' && 'bg-muted text-muted-foreground',
  )
  const Icon =
    status === 'running'
      ? Loader2
      : status === 'completed'
        ? Check
        : status === 'failed'
          ? CircleAlert
          : CircleSlash
  return (
    <span
      className={cn(
        classes,
        celebrateKey > 0 &&
          '[animation:completion-pop_420ms_cubic-bezier(0.16,1,0.3,1)_1] motion-reduce:!animate-none',
      )}
      key={celebrateKey}
    >
      {celebrateKey > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 [animation:completion-bloom_600ms_cubic-bezier(0.16,1,0.3,1)_1] rounded-full bg-success/40 motion-reduce:hidden"
        />
      )}
      <Icon className={cn('size-4', status === 'running' && 'animate-spin')} />
    </span>
  )
}

function statusMessage({
  status,
  processingTimeSeconds,
  errorMessage,
  cloud,
}: Pick<
  JobHeaderProps,
  'status' | 'processingTimeSeconds' | 'errorMessage' | 'cloud'
>) {
  if (status === 'running') {
    return cloud
      ? cloudCopy.statusRunning(cloud.estimateSeconds)
      : copy.statusRunning
  }
  if (status === 'completed')
    return processingTimeSeconds != null
      ? copy.statusCompletedIn(processingTimeSeconds)
      : copy.statusCompleted
  if (status === 'failed') return errorMessage ?? copy.statusFailedDefault
  return copy.statusCancelled
}

export function JobHeader({
  name,
  sequenceLength,
  species,
  status,
  processingTimeSeconds,
  errorMessage,
  retriable = true,
  onEdit,
  onRerun,
  onCancel,
  missing = false,
  cloud,
}: JobHeaderProps) {
  const message = statusMessage({
    status,
    processingTimeSeconds,
    errorMessage,
    cloud,
  })
  const speciesLabel = SPECIES_LABEL[species]
  const canRerun = status !== 'running' && (status !== 'failed' || retriable)

  return (
    <Card className={cn(status === 'failed' && 'border-destructive/50')}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <StatusDot status={status} />
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {/* The page's heading once a run starts: the form, and with
                    it the only h1, is gone by then. */}
                <h1 className="truncate text-sm font-semibold">
                  {name || copy.untitled}
                </h1>
                {sequenceLength != null && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    · {sequenceLength.toLocaleString()} bp
                  </span>
                )}
                {speciesLabel && (
                  <span className="text-xs text-muted-foreground">
                    · {speciesLabel}
                  </span>
                )}
              </div>
              <p
                className={cn(
                  'text-xs',
                  status === 'failed'
                    ? 'text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {message}
              </p>
              {cloud?.deleted && (
                <p className="text-xs text-muted-foreground">
                  {cloudCopy.deletedNote}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {cloud && !cloud.deleted && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cloud.onDelete}
                disabled={cloud.deleting}
              >
                <Trash2 className="size-3.5" />
                {cloud.deleting ? cloudCopy.deleting : cloudCopy.deleteAction}
              </Button>
            )}
            {status === 'running' && onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                {copy.buttonCancel}
              </Button>
            )}
            <Button
              type="button"
              variant={missing ? 'default' : 'outline'}
              size="sm"
              onClick={onEdit}
            >
              {missing ? (
                <Plus className="size-3.5" />
              ) : (
                <Pencil className="size-3.5" />
              )}
              {missing ? copy.buttonNewDesign : copy.buttonEdit}
            </Button>
            {canRerun && (
              <Button type="button" size="sm" onClick={onRerun}>
                {status === 'failed' ? (
                  <RotateCw className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
                {copy.buttonRunAgain}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import * as React from 'react'
import {
  Loader2,
  Check,
  CircleAlert,
  CircleSlash,
  Pencil,
  Play,
  RotateCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'

interface RunningPlaceholderProps {
  stage?: string
  progress?: number
}

export function RunningPlaceholder({
  stage,
  progress,
}: RunningPlaceholderProps) {
  const pct =
    typeof progress === 'number' && progress >= 0 && progress <= 100
      ? Math.round(progress)
      : null
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="relative flex size-12 items-center justify-center">
          <span className="bg-primary/10 absolute inset-0 animate-ping rounded-full" />
          <Loader2 className="text-primary relative size-6 animate-spin" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium">Optimizing your sequence…</p>
          <p className="text-muted-foreground text-xs">
            {stage ??
              'Running DNAChisel on the server. This usually takes a few seconds.'}
          </p>
        </div>
        {pct !== null && (
          <div className="w-full max-w-xs">
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-1.5 text-center text-[10px] tabular-nums">
              {pct}%
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type JobHeaderStatus = 'running' | 'completed' | 'failed' | 'cancelled'

interface JobHeaderProps {
  name: string
  sequenceLength: number
  species: DesignToolSpecies
  status: JobHeaderStatus
  processingTimeSeconds?: number | null
  errorMessage?: string | null
  retriable?: boolean
  onEdit: () => void
  onRerun: () => void
  onCancel?: () => void
}

const SPECIES_LABEL: Record<DesignToolSpecies, string> = {
  none: '',
  human: 'Human',
  mouse: 'Mouse',
}

function StatusDot({ status }: { status: JobHeaderStatus }) {
  const classes = cn(
    'flex size-7 shrink-0 items-center justify-center rounded-full',
    status === 'running' && 'bg-primary/10 text-primary',
    status === 'completed' &&
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
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
    <span className={classes}>
      <Icon className={cn('size-4', status === 'running' && 'animate-spin')} />
    </span>
  )
}

function statusMessage({
  status,
  processingTimeSeconds,
  errorMessage,
}: Pick<JobHeaderProps, 'status' | 'processingTimeSeconds' | 'errorMessage'>) {
  if (status === 'running') return 'Optimizing codons…'
  if (status === 'completed')
    return processingTimeSeconds != null
      ? `Completed in ${processingTimeSeconds}s`
      : 'Completed'
  if (status === 'failed') return errorMessage ?? 'Job failed'
  return 'Cancelled'
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
}: JobHeaderProps) {
  const message = statusMessage({ status, processingTimeSeconds, errorMessage })
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
                <h2 className="truncate text-sm font-semibold">
                  {name || 'Untitled run'}
                </h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  · {sequenceLength.toLocaleString()} bp
                </span>
                {speciesLabel && (
                  <span className="text-muted-foreground text-xs">
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
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {status === 'running' && onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            {canRerun && (
              <Button type="button" size="sm" onClick={onRerun}>
                {status === 'failed' ? (
                  <>
                    <RotateCw className="size-3.5" />
                    Run again
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" />
                    Re-run
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

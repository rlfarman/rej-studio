import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type MetricCellCommonProps = {
  label: string
  className?: string
}

type MetricCellSimpleProps = MetricCellCommonProps & {
  value: ReactNode
  valueClassName?: string
  before?: never
  after?: never
}

/**
 * An inclusive band the metric should land in, e.g. GC content at 35–60%.
 * When given, colour follows the band (inside = success, outside = warning)
 * rather than the direction of travel — a value that moved "up" out of its
 * target band is not an improvement.
 */
type MetricTarget = { min: number; max: number }

type MetricCellComparativeProps = MetricCellCommonProps & {
  before: number | null
  after: number | null
  unit?: string
  lowerIsBetter?: boolean
  target?: MetricTarget
  formatter?: (n: number) => string
  value?: never
  valueClassName?: never
}

type MetricCellProps = MetricCellSimpleProps | MetricCellComparativeProps

function Label({ children }: { children: ReactNode }) {
  return <div className="type-overline truncate">{children}</div>
}

function defaultFormat(n: number) {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
}

function inBand(value: number, target: MetricTarget) {
  return value >= target.min && value <= target.max
}

function SimpleCell({
  label,
  value,
  valueClassName,
  className,
}: MetricCellSimpleProps) {
  return (
    <div className={cn('bg-muted/30 min-w-0 px-3 py-2', className)}>
      <Label>{label}</Label>
      <div className={cn('text-sm tabular-nums', valueClassName)}>{value}</div>
    </div>
  )
}

function ComparativeCell({
  label,
  before,
  after,
  unit,
  lowerIsBetter,
  target,
  formatter,
  className,
}: MetricCellComparativeProps) {
  const fmt = formatter ?? defaultFormat
  const hasBoth = before !== null && after !== null

  // With a target band the question is "did it land in range?", not "did the
  // number go up?". Without one, fall back to direction of travel.
  let tone: 'success' | 'warning' | 'danger' | null = null
  if (target && after !== null) {
    tone = inBand(after, target) ? 'success' : 'warning'
  } else if (hasBoth) {
    const delta = after - before
    if (lowerIsBetter ? delta < 0 : delta > 0) tone = 'success'
    else if (lowerIsBetter ? delta > 0 : delta < 0) tone = 'danger'
  }

  const targetHint =
    target && after !== null && !inBand(after, target)
      ? `${label} ${fmt(after)}${unit ?? ''} is outside the ${fmt(target.min)}–${fmt(target.max)}${unit ?? ''} target`
      : undefined

  return (
    <div className={cn('bg-muted/30 min-w-0 px-3 py-2', className)}>
      <Label>{label}</Label>
      <div
        className="mt-0.5 flex min-w-0 items-center gap-1 text-sm tabular-nums"
        title={targetHint}
      >
        {hasBoth ? (
          <>
            <span className="text-muted-foreground truncate">
              {fmt(before)}
              {unit}
            </span>
            <ArrowRight className="text-muted-foreground size-3 shrink-0" />
            <span
              className={cn(
                'truncate font-medium',
                tone === 'success' && 'text-success-soft',
                tone === 'warning' && 'text-warning-soft',
                tone === 'danger' && 'text-danger-soft',
              )}
            >
              {fmt(after)}
              {unit}
            </span>
          </>
        ) : after !== null ? (
          <span
            className={cn(
              'truncate font-medium',
              tone === 'success' && 'text-success-soft',
              tone === 'warning' && 'text-warning-soft',
              tone === 'danger' && 'text-danger-soft',
            )}
          >
            {fmt(after)}
            {unit}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  )
}

export function MetricCell(props: MetricCellProps) {
  return 'value' in props && props.value !== undefined ? (
    <SimpleCell {...props} />
  ) : (
    <ComparativeCell {...(props as MetricCellComparativeProps)} />
  )
}

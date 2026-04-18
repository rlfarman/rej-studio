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

type MetricCellComparativeProps = MetricCellCommonProps & {
  before: number | null
  after: number | null
  unit?: string
  lowerIsBetter?: boolean
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
  formatter,
  className,
}: MetricCellComparativeProps) {
  const fmt = formatter ?? defaultFormat
  const hasBoth = before !== null && after !== null
  const delta = hasBoth ? after - before : 0
  const improved = lowerIsBetter ? delta < 0 : delta > 0
  const worsened = lowerIsBetter ? delta > 0 : delta < 0

  return (
    <div className={cn('bg-muted/30 min-w-0 px-3 py-2', className)}>
      <Label>{label}</Label>
      <div className="mt-0.5 flex min-w-0 items-center gap-1 text-sm tabular-nums">
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
                improved && 'text-emerald-600 dark:text-emerald-400',
                worsened && 'text-red-600 dark:text-red-400',
              )}
            >
              {fmt(after)}
              {unit}
            </span>
          </>
        ) : after !== null ? (
          <span className="truncate font-medium">
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

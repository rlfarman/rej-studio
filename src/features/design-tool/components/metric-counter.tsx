'use client'

// Spring-animated number counter. Counts up from `from` to `to` over a short
// duration, then stays put. Uses motion's useSpring so the landing feels
// physical rather than easing out. Respects prefers-reduced-motion by
// snapping to the target value.

import { useEffect } from 'react'
import {
  m,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'motion/react'
import { cn } from '@/lib/utils'

interface MetricCounterProps {
  value: number
  /** Decimals to format with. Default 0 (integer). */
  decimals?: number
  /** Optional prefix/suffix text (e.g. "%", "bp"). */
  suffix?: string
  className?: string
  style?: React.CSSProperties
}

export function MetricCounter({
  value,
  decimals = 0,
  suffix,
  className,
  style,
}: MetricCounterProps) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 80, damping: 20, mass: 0.8 })
  const display = useTransform(spring, (v) =>
    (reduce ? value : v).toFixed(decimals),
  )

  useEffect(() => {
    mv.set(value)
  }, [value, mv])

  return (
    <span
      className={cn('inline-flex items-baseline tabular-nums', className)}
      style={style}
    >
      <m.span>{display}</m.span>
      {suffix && (
        <span className="text-muted-foreground ml-0.5 text-sm">{suffix}</span>
      )}
    </span>
  )
}

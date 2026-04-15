'use client'
import { type ReactNode } from 'react'
import { m } from 'motion/react'

const dnaFloat = {
  rotate: [0, 3, 0],
  transition: {
    duration: 6,
    ease: 'easeInOut' as const,
    repeat: Infinity,
  },
}

export function Hero({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

export function HeroItem({
  children,
  className,
  index = 0,
  ...rest
}: React.ComponentProps<'div'> & {
  index?: number
}) {
  return (
    <div
      className={`hero-stagger ${className ?? ''}`}
      style={{ '--stagger': index } as React.CSSProperties}
      {...rest}
    >
      {children}
    </div>
  )
}

export function DnaFloat({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <m.div animate={dnaFloat} className={className}>
      {children}
    </m.div>
  )
}

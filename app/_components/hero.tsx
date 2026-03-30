'use client'
import { type ReactNode } from 'react'
import { m } from 'motion/react'
import { staggerContainer, fadeUp } from '@/lib/motion'

const dnaFloat = {
  rotate: [0, 8, 0],
  transition: {
    duration: 4,
    ease: 'easeInOut' as const,
    repeat: Infinity,
  },
}

export function Hero({ children }: { children: ReactNode }) {
  return (
    <m.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </m.div>
  )
}

export function HeroItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div variants={fadeUp} className={className}>
      {children}
    </m.div>
  )
}

export function DnaFloat({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div animate={dnaFloat} className={className}>
      {children}
    </m.div>
  )
}

'use client'
import { type ReactNode } from 'react'
import { motion } from 'motion/react'

const staggerChildren = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
}

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
    <motion.div
      variants={staggerChildren}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

export function HeroItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  )
}

export function DnaFloat({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div animate={dnaFloat} className={className}>
      {children}
    </motion.div>
  )
}

import type { Transition, Variants } from 'motion/react'

/** Quick fade for swapping content (copy feedback, button states) */
export const quickFade: Transition = { duration: 0.15 }

/** Spring for tactile interactions (favorites, success states) */
export const popSpring: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 15,
}

/** Gentler spring for larger elements */
export const softSpring: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 25,
}

/** Staggered entrance for hero-style layouts */
const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
}

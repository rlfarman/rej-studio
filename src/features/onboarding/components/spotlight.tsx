'use client'

import { m, AnimatePresence } from 'motion/react'
import type { Transition } from 'motion/react'

const spotlightEase: Transition = { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface SpotlightProps {
  rect: SpotlightRect | null
  padding?: number
  borderRadius?: number
  onClick?: () => void
}

export function Spotlight({
  rect,
  padding = 8,
  borderRadius = 12,
  onClick,
}: SpotlightProps) {
  return (
    <AnimatePresence>
      {rect && (
        <>
          {/* Clickable backdrop that dismisses the tour */}
          <m.div
            className="fixed inset-0 z-[9998] cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            aria-hidden
          />
          {/* Spotlight cutout — box-shadow creates the dimmed overlay */}
          <m.div
            className="pointer-events-none fixed z-[9998] rounded-lg"
            style={{ borderRadius }}
            initial={{
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0)',
            }}
            animate={{
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            }}
            exit={{
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0)',
            }}
            transition={spotlightEase}
          />
          {/* Inner glow ring for visual polish */}
          <m.div
            className="pointer-events-none fixed z-[9998] ring-2 ring-white/20"
            style={{ borderRadius }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
            }}
            exit={{ opacity: 0 }}
            transition={spotlightEase}
          />
        </>
      )}
    </AnimatePresence>
  )
}

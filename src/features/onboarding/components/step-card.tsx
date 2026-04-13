'use client'

import { m, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { popSpring } from '@/lib/motion'
import type { TourPlacement } from '../types'

interface StepCardProps {
  title: string
  description: string
  stepIndex: number
  totalSteps: number
  placement: TourPlacement
  targetRect: DOMRect | null
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}

const CARD_OFFSET = 16
const CARD_WIDTH = 320

function getCardPosition(
  rect: DOMRect,
  placement: TourPlacement,
): React.CSSProperties {
  switch (placement) {
    case 'bottom':
      return {
        top: rect.bottom + CARD_OFFSET,
        left: rect.left + rect.width / 2 - CARD_WIDTH / 2,
      }
    case 'top':
      return {
        bottom: window.innerHeight - rect.top + CARD_OFFSET,
        left: rect.left + rect.width / 2 - CARD_WIDTH / 2,
      }
    case 'left':
      return {
        top: rect.top + rect.height / 2,
        right: window.innerWidth - rect.left + CARD_OFFSET,
        transform: 'translateY(-50%)',
      }
    case 'right':
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + CARD_OFFSET,
        transform: 'translateY(-50%)',
      }
  }
}

function getInitialOffset(placement: TourPlacement) {
  switch (placement) {
    case 'bottom':
      return { y: -8 }
    case 'top':
      return { y: 8 }
    case 'left':
      return { x: 8 }
    case 'right':
      return { x: -8 }
  }
}

export function StepCard({
  title,
  description,
  stepIndex,
  totalSteps,
  placement,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: StepCardProps) {
  const isFirst = stepIndex === 0
  const isLast = stepIndex === totalSteps - 1

  return (
    <AnimatePresence mode="wait">
      {targetRect && (
        <m.div
          key={stepIndex}
          className="bg-popover text-popover-foreground fixed z-[9999] w-80 rounded-xl border p-4 shadow-2xl"
          style={getCardPosition(targetRect, placement)}
          initial={{ opacity: 0, scale: 0.95, ...getInitialOffset(placement) }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={popSpring}
        >
          {/* Close button */}
          <button
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground absolute top-3 right-3 rounded-sm p-0.5 transition-colors"
            aria-label="Close tour"
          >
            <X className="size-3.5" />
          </button>

          {/* Content */}
          <div className="pr-6">
            <h3 className="text-sm leading-tight font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
              {description}
            </p>
          </div>

          {/* Footer: progress + nav */}
          <div className="mt-4 flex items-center justify-between">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => (
                <m.div
                  key={i}
                  className="rounded-full"
                  animate={{
                    width: i === stepIndex ? 16 : 6,
                    height: 6,
                    backgroundColor:
                      i === stepIndex
                        ? 'hsl(var(--primary))'
                        : 'hsl(var(--muted-foreground) / 0.3)',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onPrev}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="size-4" />
                </Button>
              )}
              <Button size="sm" onClick={onNext} className="h-7 gap-1 px-3">
                {isLast ? (
                  'Done'
                ) : (
                  <>
                    Next
                    <ChevronRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

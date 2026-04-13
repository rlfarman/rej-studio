'use client'

import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { Spotlight } from './spotlight'
import { StepCard } from './step-card'
import { useOnboarding } from '../stores/onboarding-store'
import type { TourDefinition, TourId } from '../types'

interface TourProps {
  tour: TourDefinition
  /** Delay before auto-starting on first visit (ms) */
  autoStartDelay?: number
}

function useTargetRect(selector: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  const measure = useCallback(() => {
    if (!selector) {
      setRect(null)
      return
    }
    const el = document.querySelector(selector)
    if (el) {
      const r = el.getBoundingClientRect()
      setRect((prev) => {
        if (
          prev &&
          prev.top === r.top &&
          prev.left === r.left &&
          prev.width === r.width &&
          prev.height === r.height
        ) {
          return prev
        }
        return r
      })
    } else {
      setRect(null)
    }
  }, [selector])

  useEffect(() => {
    if (!selector) {
      setRect(null)
      return
    }

    measure()

    // Re-measure on resize and DOM mutations (async renders)
    window.addEventListener('resize', measure)
    const observer = new MutationObserver(measure)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('resize', measure)
      observer.disconnect()
    }
  }, [selector, measure])

  return { rect, remeasure: measure }
}

/** Height reserved for the step card + gap */
const CARD_HEIGHT = 200

function scrollTargetIntoView(
  selector: string,
  placement: 'top' | 'bottom' | 'left' | 'right',
): Promise<void> {
  const el = document.querySelector(selector)
  if (!el) return Promise.resolve()

  const r = el.getBoundingClientRect()
  const vh = window.innerHeight

  // Check whether the target AND the card both fit in the viewport
  const cardAbove = placement === 'top'
  const neededTop = cardAbove ? CARD_HEIGHT : 60
  const neededBottom = cardAbove ? 60 : CARD_HEIGHT
  const fits = r.top >= neededTop && r.bottom <= vh - neededBottom

  if (fits) return Promise.resolve()

  // Place the target so there's room for the card on the correct side.
  // 'start' pushes the element to the top → room below for the card.
  // 'end' pushes the element to the bottom → room above for the card.
  const block: ScrollLogicalPosition = cardAbove ? 'end' : 'start'
  el.scrollIntoView({ behavior: 'smooth', block })

  return new Promise((resolve) => setTimeout(resolve, 450))
}

function useScrollLock(active: boolean, ready: boolean) {
  useEffect(() => {
    if (!active || !ready) return

    const main = document.getElementById('main-content')
    const prevMainOverflow = main?.style.overflow ?? ''
    const prevBodyOverflow = document.body.style.overflow

    if (main) main.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      if (main) main.style.overflow = prevMainOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [active, ready])
}

export function Tour({ tour, autoStartDelay = 600 }: TourProps) {
  const {
    activeTourId,
    activeStepIndex,
    startTour,
    nextStep,
    prevStep,
    endTour,
    isTourCompleted,
    hasSeenWelcome,
  } = useOnboarding()

  const isActive = activeTourId === tour.id
  const currentStep = isActive ? tour.steps[activeStepIndex] : null
  const { rect: targetRect, remeasure } = useTargetRect(
    currentStep?.target ?? null,
  )

  // Track when scroll has settled so we can lock
  const [scrollReady, setScrollReady] = useState(false)

  // Lock scroll only after the target has been scrolled into view
  useScrollLock(isActive, scrollReady)

  // Auto-start tour on first visit (after welcome is dismissed)
  useEffect(() => {
    if (isTourCompleted(tour.id as TourId) || !hasSeenWelcome) return
    if (activeTourId !== null) return

    const timer = setTimeout(() => {
      const firstTarget = document.querySelector(tour.steps[0].target)
      if (firstTarget) {
        startTour(tour.id as TourId)
      }
    }, autoStartDelay)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [hasSeenWelcome])

  // Scroll target + card into view, then lock scroll and re-measure
  useEffect(() => {
    if (!currentStep) return
    setScrollReady(false)

    let cancelled = false
    scrollTargetIntoView(currentStep.target, currentStep.placement).then(() => {
      if (cancelled) return
      remeasure()
      setScrollReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [currentStep, remeasure])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        endTour()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        if (activeStepIndex < tour.steps.length - 1) {
          nextStep()
        } else {
          endTour()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevStep()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isActive,
    activeStepIndex,
    tour.steps.length,
    endTour,
    nextStep,
    prevStep,
  ])

  if (!isActive || !currentStep) return null

  const handleNext = () => {
    if (activeStepIndex < tour.steps.length - 1) {
      nextStep()
    } else {
      endTour()
    }
  }

  return createPortal(
    <>
      <Spotlight
        rect={
          targetRect
            ? {
                top: targetRect.top,
                left: targetRect.left,
                width: targetRect.width,
                height: targetRect.height,
              }
            : null
        }
        padding={currentStep.spotlightPadding}
        onClick={endTour}
      />
      <StepCard
        title={currentStep.title}
        description={currentStep.description}
        stepIndex={activeStepIndex}
        totalSteps={tour.steps.length}
        placement={currentStep.placement}
        targetRect={targetRect}
        onNext={handleNext}
        onPrev={prevStep}
        onSkip={endTour}
      />
    </>,
    document.body,
  )
}

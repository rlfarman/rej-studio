'use client'

import { useEffect, useRef } from 'react'
import { driver, type Driver } from 'driver.js'
import { useOnboarding } from '../stores/onboarding-store'
import type { TourDefinition } from '../tours'

interface UseTourOptions {
  tour: TourDefinition
  autoStartDelay?: number
}

export function useTour({ tour, autoStartDelay = 600 }: UseTourOptions) {
  const driverRef = useRef<Driver | null>(null)
  const endTourRef = useRef<() => void>(() => {})
  const cleaningUpRef = useRef(false)
  const { activeTourId, startTour, endTour, isTourCompleted, hasSeenWelcome } =
    useOnboarding()

  endTourRef.current = endTour

  // Create driver instance once per tour definition
  useEffect(() => {
    const d = driver({
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      animate: true,
      smoothScroll: true,
      allowClose: true,
      overlayOpacity: 0.5,
      stagePadding: 8,
      stageRadius: 12,
      popoverOffset: 16,
      popoverClass: 'rej-tour-popover',
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Next →',
      prevBtnText: '← Prev',
      doneBtnText: 'Done',
      steps: tour.steps,
      onDestroyed: () => {
        if (!cleaningUpRef.current) {
          endTourRef.current()
        }
      },
    })

    driverRef.current = d
    return () => {
      cleaningUpRef.current = true
      d.destroy()
      cleaningUpRef.current = false
      driverRef.current = null
    }
  }, [tour.steps])

  // Start/stop the driver when activeTourId changes
  useEffect(() => {
    const d = driverRef.current
    if (!d) return

    if (activeTourId === tour.id) {
      d.drive()
    } else if (d.isActive()) {
      cleaningUpRef.current = true
      d.destroy()
      cleaningUpRef.current = false
    }
  }, [activeTourId, tour.id])

  // Auto-start on first visit after welcome
  useEffect(() => {
    if (isTourCompleted(tour.id) || !hasSeenWelcome) return
    if (activeTourId !== null) return

    const timer = setTimeout(() => {
      const firstEl = tour.steps[0]?.element
      const selector = typeof firstEl === 'string' ? firstEl : null
      if (selector && document.querySelector(selector)) {
        startTour(tour.id)
      }
    }, autoStartDelay)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [hasSeenWelcome])
}

'use client'

import { useEffect, useRef } from 'react'
import { driver, type Driver } from 'driver.js'
import { useOnboarding } from '../stores/onboarding-store'
import type { TourDefinition } from '../tours'

interface UseTourOptions {
  tour: TourDefinition
}

export function useTour({ tour }: UseTourOptions) {
  const driverRef = useRef<Driver | null>(null)
  const endTourRef = useRef<() => void>(() => {})
  const cleaningUpRef = useRef(false)
  const { activeTourId, endTour } = useOnboarding()

  useEffect(() => {
    endTourRef.current = endTour
  }, [endTour])

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
}

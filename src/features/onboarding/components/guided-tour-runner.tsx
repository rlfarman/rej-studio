'use client'

import { useEffect, useRef } from 'react'
import { driver, type Driver } from 'driver.js'
import { usePathname, useRouter } from 'next/navigation'
import { useOnboarding } from '../stores/onboarding-store'
import { guidedTour } from '../tours'

const DRIVER_CONFIG = {
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
  showButtons: ['next', 'previous', 'close'] as (
    | 'next'
    | 'previous'
    | 'close'
  )[],
  nextBtnText: 'Next →',
  prevBtnText: '← Prev',
  doneBtnText: 'Done',
} as const

/**
 * Drives the cross-route "guided" tour. One driver instance per step:
 * navigation, element mount, and index changes all live in React state, so
 * we tear down and rebuild when anything shifts. That keeps driver.js honest
 * (its `steps[]` model doesn't know about routing) without fighting it.
 */
export function GuidedTourRunner() {
  const pathname = usePathname()
  const router = useRouter()
  const activeTourId = useOnboarding((s) => s.activeTourId)
  const stepIndex = useOnboarding((s) => s.guidedStepIndex)
  const setStepIndex = useOnboarding((s) => s.setGuidedStepIndex)
  const endTour = useOnboarding((s) => s.endTour)
  const driverRef = useRef<Driver | null>(null)

  useEffect(() => {
    if (activeTourId !== 'guided') return
    const step = guidedTour[stepIndex]
    if (!step) {
      endTour()
      return
    }

    // If we need to be on a different route, navigate and wait for the
    // effect to re-run after pathname updates.
    if (step.route !== pathname) {
      router.push(step.route)
      return
    }

    let disposed = false
    let raf = 0
    const start = () => {
      if (disposed) return
      const el = document.querySelector(step.element as string)
      if (!el) {
        raf = requestAnimationFrame(start)
        return
      }

      const advanceTo = (nextIndex: number) => {
        const next = guidedTour[nextIndex]
        driverRef.current?.destroy()
        driverRef.current = null
        if (!next) {
          endTour()
          return
        }
        if (next.route !== pathname) {
          // Write the new index first so the effect re-run after navigation
          // drives the correct step.
          setStepIndex(nextIndex)
          router.push(next.route)
          return
        }
        setStepIndex(nextIndex)
      }

      const d = driver({
        ...DRIVER_CONFIG,
        steps: guidedTour.map((s) => ({
          element: s.element,
          popover: s.popover,
        })),
        onNextClick: () => advanceTo(stepIndex + 1),
        onPrevClick: () => advanceTo(stepIndex - 1),
        onCloseClick: () => {
          driverRef.current?.destroy()
          driverRef.current = null
          endTour()
        },
      })
      driverRef.current = d
      d.drive(stepIndex)
    }
    start()

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      driverRef.current?.destroy()
      driverRef.current = null
    }
  }, [activeTourId, pathname, stepIndex, router, setStepIndex, endTour])

  return null
}

'use client'

import { useEffect, useRef } from 'react'

/**
 * Floating ring that traces driver.js's active element. We can't rely on
 * `outline` on `.driver-active-element` because many targets live inside
 * ancestors with `overflow: hidden`, which clips the ring. Rendering a
 * fixed-positioned sibling on <body> sidesteps that entirely.
 *
 * Updates happen via direct style mutation (no React re-renders) to keep the
 * rAF loop cheap.
 */
const STAGE_PADDING = 6
const STAGE_RADIUS = 12

export function TourRingOverlay() {
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ring = ringRef.current
    if (!ring) return

    let rafId = 0
    let running = false

    const hide = () => {
      ring.style.opacity = '0'
    }

    const update = () => {
      if (!running) return
      const el = document.querySelector<HTMLElement>('.driver-active-element')
      if (!el) {
        hide()
      } else {
        const r = el.getBoundingClientRect()
        ring.style.opacity = '1'
        ring.style.transform = `translate3d(${r.left - STAGE_PADDING}px, ${r.top - STAGE_PADDING}px, 0)`
        ring.style.width = `${r.width + STAGE_PADDING * 2}px`
        ring.style.height = `${r.height + STAGE_PADDING * 2}px`
      }
      rafId = requestAnimationFrame(update)
    }

    const start = () => {
      if (running) return
      running = true
      update()
    }
    const stop = () => {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
      hide()
    }

    const syncToBodyState = () => {
      if (document.body.classList.contains('driver-active')) start()
      else stop()
    }

    const observer = new MutationObserver(syncToBodyState)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    })
    syncToBodyState()

    return () => {
      observer.disconnect()
      stop()
    }
  }, [])

  return (
    <div
      ref={ringRef}
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        borderRadius: STAGE_RADIUS,
        boxShadow:
          '0 0 0 2px var(--primary), 0 0 18px color-mix(in srgb, var(--primary) 45%, transparent)',
        pointerEvents: 'none',
        zIndex: 10002,
        opacity: 0,
        transition: 'opacity 150ms ease',
        willChange: 'transform, width, height',
      }}
    />
  )
}

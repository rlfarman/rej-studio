'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampBpPerPixel,
  clampCenterBp,
  fitBpPerPixel,
  MIN_BP_PER_PX,
} from '../lib/lod'
import type { Viewport } from '../types'

interface Options {
  length: number
  widthPx: number
  reducedMotion: boolean
}

interface Controls {
  viewport: Viewport
  /** Current rendered viewport (animating toward target in non-reduced-motion). */
  rendered: Viewport
  setTarget: (next: Partial<Viewport>) => void
  zoomBy: (factor: number, anchorPx?: number) => void
  panByPx: (dx: number) => void
  fit: () => void
  isAnimating: boolean
}

/**
 * Spring-style viewport that eases toward its target. In reduced-motion mode,
 * the rendered viewport snaps immediately — no easing, no tween.
 *
 * All bp coordinates are 0-based center-of-viewport; widthPx is the canvas's
 * CSS width.
 */
export function useGeneMapViewport({
  length,
  widthPx,
  reducedMotion,
}: Options): Controls {
  const initialBpPerPixel = fitBpPerPixel(length, widthPx || 800)
  const initial: Viewport = {
    centerBp: length / 2,
    bpPerPixel: initialBpPerPixel,
  }

  const [target, setTargetState] = useState<Viewport>(initial)
  const [rendered, setRendered] = useState<Viewport>(initial)
  const renderedRef = useRef<Viewport>(initial)
  const targetRef = useRef<Viewport>(initial)
  const rafRef = useRef<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  // If the sequence length or width changes significantly, refit once.
  const fitKey = `${length}-${Math.round(widthPx)}`
  const fitKeyRef = useRef(fitKey)
  useEffect(() => {
    if (fitKeyRef.current === fitKey) return
    fitKeyRef.current = fitKey
    const next: Viewport = {
      centerBp: length / 2,
      bpPerPixel: fitBpPerPixel(length, widthPx || 800),
    }
    setTargetState(next)
    setRendered(next)
    targetRef.current = next
    renderedRef.current = next
  }, [fitKey, length, widthPx])

  const applyTarget = useCallback(
    (next: Viewport) => {
      const clamped: Viewport = {
        bpPerPixel: clampBpPerPixel(next.bpPerPixel),
        centerBp: clampCenterBp(
          next.centerBp,
          clampBpPerPixel(next.bpPerPixel),
          widthPx || 800,
          length,
        ),
      }
      targetRef.current = clamped
      setTargetState(clamped)
      if (reducedMotion) {
        renderedRef.current = clamped
        setRendered(clamped)
      } else {
        setIsAnimating(true)
      }
    },
    [length, widthPx, reducedMotion],
  )

  useEffect(() => {
    if (reducedMotion || !isAnimating) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(64, now - last) / 1000
      last = now
      const t = targetRef.current
      const r = renderedRef.current
      // Critically-damped spring approximation. k controls stiffness.
      const k = 16
      const alpha = 1 - Math.exp(-k * dt)
      const nextCenter = r.centerBp + (t.centerBp - r.centerBp) * alpha
      // Interpolate zoom in log space — feels linear to the user.
      const logR = Math.log(Math.max(MIN_BP_PER_PX, r.bpPerPixel))
      const logT = Math.log(Math.max(MIN_BP_PER_PX, t.bpPerPixel))
      const nextLog = logR + (logT - logR) * alpha
      const nextBpp = Math.exp(nextLog)
      const next = { centerBp: nextCenter, bpPerPixel: nextBpp }
      renderedRef.current = next
      setRendered(next)
      const centerDone = Math.abs(t.centerBp - nextCenter) < t.bpPerPixel * 0.25
      const zoomDone = Math.abs(logT - nextLog) < 0.001
      if (centerDone && zoomDone) {
        renderedRef.current = t
        setRendered(t)
        setIsAnimating(false)
        rafRef.current = null
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [isAnimating, reducedMotion])

  const setTargetPartial = useCallback(
    (next: Partial<Viewport>) => {
      applyTarget({ ...targetRef.current, ...next })
    },
    [applyTarget],
  )

  const zoomBy = useCallback(
    (factor: number, anchorPx?: number) => {
      const t = targetRef.current
      const w = widthPx || 800
      const anchor = anchorPx ?? w / 2
      // bp coordinate under the anchor before zoom
      const bpAtAnchorBefore = t.centerBp + (anchor - w / 2) * t.bpPerPixel
      const nextBpp = clampBpPerPixel(t.bpPerPixel * factor)
      // Keep that bp under the anchor after zoom
      const nextCenter = bpAtAnchorBefore - (anchor - w / 2) * nextBpp
      applyTarget({ centerBp: nextCenter, bpPerPixel: nextBpp })
    },
    [widthPx, applyTarget],
  )

  const panByPx = useCallback(
    (dx: number) => {
      const t = targetRef.current
      applyTarget({
        centerBp: t.centerBp - dx * t.bpPerPixel,
        bpPerPixel: t.bpPerPixel,
      })
    },
    [applyTarget],
  )

  const fit = useCallback(() => {
    applyTarget({
      centerBp: length / 2,
      bpPerPixel: fitBpPerPixel(length, widthPx || 800),
    })
  }, [applyTarget, length, widthPx])

  return {
    viewport: target,
    rendered,
    setTarget: setTargetPartial,
    zoomBy,
    panByPx,
    fit,
    isAnimating,
  }
}

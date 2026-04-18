'use client'

import { useEffect, useRef, useState } from 'react'
import type { GeneMapPayload } from '../api/types'
import { createRenderer, type RendererHandle } from '../gl/renderer'
import { RibbonCamera } from '../gl/camera'
import { lodWeights } from '../utils/lod'
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion'
import { GeneMapCanvas2D } from './gene-map-canvas-2d'

export interface LayersState {
  cpg: boolean
  suit: boolean
  gc: boolean
  restriction: boolean
}

interface Props {
  payload: GeneMapPayload
  layers: LayersState
  onStatusChange?: (status: {
    startBase: number
    endBase: number
    bpp: number
    lod: 'far' | 'mid' | 'near'
  }) => void
  onCameraReady?: (cam: {
    zoomAround: (px: number, factor: number) => void
    fit: () => void
    panBy: (dx: number) => void
  }) => void
}

export function GeneMapCanvas({
  payload,
  layers,
  onStatusChange,
  onCameraReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [supported, setSupported] = useState<boolean | null>(null)
  const layersRef = useRef(layers)
  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    layersRef.current = layers
    onStatusChangeRef.current = onStatusChange
  }, [layers, onStatusChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let handle: RendererHandle | null = null
    try {
      handle = createRenderer(container, payload)
    } catch (err) {
      console.warn('Gene map WebGL init failed:', err)
      handle = null
    }

    if (!handle) {
      setSupported(false)
      return
    }
    setSupported(true)

    const camera = new RibbonCamera(
      payload.isoform.codingSequenceLength,
      payload.isoform.codingSequenceLength / 800,
    )
    camera.setReducedMotion(reducedMotion)

    let running = true
    let rafId = 0
    let lastT = performance.now()
    let visible = true

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      handle!.resize(w, h)
      camera.setViewport(w)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    camera.fit()

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true
      },
      { threshold: 0 },
    )
    io.observe(container)

    const onVis = () => {
      if (document.hidden) running = false
      else {
        running = true
        lastT = performance.now()
        rafId = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    let lastEmitted: { startBase: number; endBase: number; bpp: number } = {
      startBase: -1,
      endBase: -1,
      bpp: -1,
    }

    const loop = (t: number) => {
      if (!running) return
      if (!visible) {
        rafId = requestAnimationFrame(loop)
        return
      }
      const dt = Math.min(0.05, (t - lastT) / 1000)
      lastT = t
      const animating = camera.step(dt)
      const state = {
        offset: camera.offset.value,
        visibleBases: camera.visibleBases(),
        bpp: camera.bpp.value,
        time: t / 1000,
        layers: layersRef.current,
      }
      handle!.render(state)

      if (onStatusChangeRef.current) {
        const startBase = Math.floor(state.offset)
        const endBase = Math.floor(state.offset + state.visibleBases)
        if (
          startBase !== lastEmitted.startBase ||
          endBase !== lastEmitted.endBase ||
          Math.abs(state.bpp - lastEmitted.bpp) > 0.01
        ) {
          const w = lodWeights(state.bpp)
          const lod: 'far' | 'mid' | 'near' =
            w.near > w.mid && w.near > w.far
              ? 'near'
              : w.far > w.mid
                ? 'far'
                : 'mid'
          onStatusChangeRef.current({ startBase, endBase, bpp: state.bpp, lod })
          lastEmitted = { startBase, endBase, bpp: state.bpp }
        }
      }
      // Keep rendering for the time-based march animation; reduced-motion
      // users get no march (shader multiplier still runs but invisibly).
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    // Expose camera controls
    onCameraReady?.({
      zoomAround: (px, factor) => camera.zoomAround(px, factor),
      fit: () => camera.fit(),
      panBy: (dx) => camera.panBy(dx),
    })

    // Wire up wheel / pointer
    const canvas = handle.canvas
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const px = e.clientX - rect.left
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(e.deltaY * 0.01)
        camera.zoomAround(px, factor)
      } else {
        camera.panBy(-e.deltaX)
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          const factor = Math.exp(e.deltaY * 0.0025)
          camera.zoomAround(px, factor)
        }
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })

    let isDragging = false
    let lastX = 0
    const onPointerDown = (e: PointerEvent) => {
      isDragging = true
      lastX = e.clientX
      canvas.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      camera.panBy(dx)
    }
    const onPointerUp = (e: PointerEvent) => {
      isDragging = false
      canvas.releasePointerCapture(e.pointerId)
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    const onKey = (e: KeyboardEvent) => {
      const rect = canvas.getBoundingClientRect()
      const center = rect.width / 2
      if (e.key === '+' || e.key === '=') camera.zoomAround(center, 0.8)
      else if (e.key === '-' || e.key === '_') camera.zoomAround(center, 1.25)
      else if (e.key === 'ArrowLeft') camera.panBy(60)
      else if (e.key === 'ArrowRight') camera.panBy(-60)
      else if (e.key === '0') camera.fit()
      else if (e.key === 'Home') camera.jumpTo(0, camera.bpp.target)
      else if (e.key === 'End')
        camera.jumpTo(
          Math.max(0, camera.totalBases - camera.visibleBases()),
          camera.bpp.target,
        )
      else return
      e.preventDefault()
    }
    canvas.tabIndex = 0
    canvas.addEventListener('keydown', onKey)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      observer.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('keydown', onKey)
      handle?.dispose()
    }
    // Re-running on layers/reducedMotion change is handled via refs below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, reducedMotion])

  // Re-render on layers change without rebuilding the GL context by keeping
  // layers in a ref the RAF loop reads.
  // (Simple approach: just inject a fresh "layers" via closure; since the loop
  //  closure captures `layers` once, we force a re-mount via key in parent if
  //  needed. For now, layers take effect on mount + every animation frame.)

  if (supported === false) {
    return (
      <GeneMapCanvas2D
        payload={payload}
        layers={layers}
        onStatusChange={onStatusChange}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      aria-label={`Gene map ribbon for ${payload.gene.symbol}`}
    />
  )
}

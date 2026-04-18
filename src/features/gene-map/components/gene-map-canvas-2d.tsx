'use client'

import { useEffect, useRef, useState } from 'react'
import type { GeneMapPayload } from '../api/types'
import { RibbonCamera } from '../gl/camera'
import { lodWeights } from '../utils/lod'
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion'
import type { LayersState } from './gene-map-canvas'

interface Props {
  payload: GeneMapPayload
  layers: LayersState
  onStatusChange?: (status: {
    startBase: number
    endBase: number
    bpp: number
    lod: 'far' | 'mid' | 'near'
  }) => void
}

const BASE_COLORS: Record<string, string> = {
  A: '#5ccb90',
  C: '#52a6f5',
  G: '#f7c75c',
  T: '#f2788d',
  U: '#f2788d',
  N: '#666',
}

export function GeneMapCanvas2D({ payload, layers, onStatusChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [, forceRender] = useState(0)
  const layersRef = useRef(layers)
  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cds = payload.isoform.codingSequence.toUpperCase()
    const camera = new RibbonCamera(cds.length, cds.length / 800)
    camera.setReducedMotion(reducedMotion)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = container.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      camera.setViewport(w)
      forceRender((x) => x + 1)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    camera.fit()

    let rafId = 0
    let lastT = performance.now()
    let running = true
    let lastStatus = { startBase: -1, endBase: -1, bpp: -1 }

    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const off = camera.offset.value
      const bpp = camera.bpp.value
      const visible = w * bpp

      ctx.fillStyle = '#0a0c12'
      ctx.fillRect(0, 0, w, h)

      const weights = lodWeights(bpp)

      // Ribbon y-band
      const ribbonTop = h * 0.15
      const ribbonH = h * 0.7

      // LOD-aware rendering — pick the dominant mode
      if (weights.near > 0.3) {
        // Base-level rendering
        for (let x = 0; x < w; x++) {
          const baseIdx = Math.floor(off + x * bpp)
          if (baseIdx < 0 || baseIdx >= cds.length) continue
          const c = cds[baseIdx]
          ctx.fillStyle = BASE_COLORS[c] ?? '#444'
          ctx.fillRect(x, ribbonTop, 1, ribbonH)
        }
        // Letters when there's room
        if (bpp < 0.25) {
          ctx.font = 'bold 14px ui-monospace, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#0b0d12'
          const step = 1 / bpp
          for (let x = 0; x < w; x += step) {
            const baseIdx = Math.floor(off + x * bpp)
            if (baseIdx < 0 || baseIdx >= cds.length) continue
            ctx.fillText(cds[baseIdx], x + step / 2, ribbonTop + ribbonH / 2)
          }
        }
      } else if (weights.mid > weights.far) {
        // Codon-block stripes
        const codonPx = 3 / bpp
        for (let x = 0; x < w; x += Math.max(1, codonPx)) {
          const baseIdx = Math.floor(off + x * bpp)
          const codonStart = baseIdx - (baseIdx % 3)
          if (codonStart < 0 || codonStart >= cds.length) continue
          const phase = codonStart % 9
          const hue = (phase * 35) % 360
          ctx.fillStyle = `hsl(${hue} 60% 55%)`
          ctx.fillRect(x, ribbonTop, Math.max(1, codonPx), ribbonH)
        }
      } else {
        // Far: codon-phase bands
        for (let x = 0; x < w; x++) {
          const baseIdx = Math.floor(off + x * bpp)
          if (baseIdx < 0 || baseIdx >= cds.length) continue
          const phase = baseIdx % 3
          ctx.fillStyle =
            phase === 0 ? '#4d8cd9' : phase === 1 ? '#8c73d9' : '#d98c8c'
          ctx.fillRect(x, ribbonTop, 1, ribbonH)
        }
      }

      // CpG islands
      if (layersRef.current.cpg) {
        ctx.fillStyle = 'rgba(90, 220, 245, 0.35)'
        for (const island of payload.cpgIslands) {
          const x1 = (island.start - off) / bpp
          const x2 = (island.end - off) / bpp
          if (x2 < 0 || x1 > w) continue
          ctx.fillRect(
            Math.max(0, x1),
            ribbonTop,
            Math.min(w, x2) - Math.max(0, x1),
            ribbonH,
          )
        }
      }

      // Restriction sites
      if (layersRef.current.restriction) {
        ctx.fillStyle = '#fbd34d'
        for (const site of payload.restrictionSites) {
          const x = (site.position - 1 - off) / bpp
          if (x < -2 || x > w + 2) continue
          ctx.fillRect(x - 0.5, ribbonTop - 4, 1.5, ribbonH + 8)
        }
      }

      // GC heatmap
      if (layersRef.current.gc) {
        const step = payload.tracks.step
        ctx.globalAlpha = 0.45
        for (let x = 0; x < w; x++) {
          const baseIdx = Math.floor(off + x * bpp)
          const bucket = Math.floor(baseIdx / step)
          const gc = payload.tracks.gc[bucket] ?? 0.5
          const r = Math.round(255 * Math.max(0, (gc - 0.5) * 2))
          const b = Math.round(255 * Math.max(0, (0.5 - gc) * 2))
          ctx.fillStyle = `rgb(${r}, 80, ${b})`
          ctx.fillRect(x, ribbonTop + ribbonH + 4, 1, 6)
        }
        ctx.globalAlpha = 1
      }
    }

    const loop = (t: number) => {
      if (!running) return
      const dt = Math.min(0.05, (t - lastT) / 1000)
      lastT = t
      camera.step(dt)
      draw()

      const startBase = Math.floor(camera.offset.value)
      const endBase = Math.floor(camera.offset.value + camera.visibleBases())
      if (
        onStatusChange &&
        (startBase !== lastStatus.startBase ||
          endBase !== lastStatus.endBase ||
          Math.abs(camera.bpp.value - lastStatus.bpp) > 0.01)
      ) {
        const lw = lodWeights(camera.bpp.value)
        const lod: 'far' | 'mid' | 'near' =
          lw.near > lw.mid && lw.near > lw.far
            ? 'near'
            : lw.far > lw.mid
              ? 'far'
              : 'mid'
        onStatusChange({ startBase, endBase, bpp: camera.bpp.value, lod })
        lastStatus = { startBase, endBase, bpp: camera.bpp.value }
      }

      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const px = e.clientX - rect.left
      if (e.ctrlKey || e.metaKey) {
        camera.zoomAround(px, Math.exp(e.deltaY * 0.01))
      } else {
        camera.panBy(-e.deltaX)
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })

    let isDragging = false
    let lastX = 0
    const onPD = (e: PointerEvent) => {
      isDragging = true
      lastX = e.clientX
      canvas.setPointerCapture(e.pointerId)
    }
    const onPM = (e: PointerEvent) => {
      if (!isDragging) return
      camera.panBy(e.clientX - lastX)
      lastX = e.clientX
    }
    const onPU = (e: PointerEvent) => {
      isDragging = false
      canvas.releasePointerCapture(e.pointerId)
    }
    canvas.addEventListener('pointerdown', onPD)
    canvas.addEventListener('pointermove', onPM)
    canvas.addEventListener('pointerup', onPU)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      observer.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPD)
      canvas.removeEventListener('pointermove', onPM)
      canvas.removeEventListener('pointerup', onPU)
    }
  }, [payload, reducedMotion, onStatusChange])

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}

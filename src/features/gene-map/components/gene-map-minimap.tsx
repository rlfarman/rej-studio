'use client'
import { useEffect, useMemo, useRef } from 'react'
import { AA_CLASS_COLORS } from '../lib/aa-classes'
import { downsampleAaClass } from '../lib/layer-data'
import type { Viewport } from '../types'

interface Props {
  sequence: string
  length: number
  viewportRef: React.MutableRefObject<Viewport>
  widthPx: number
  heightPx: number
  theme: 'light' | 'dark'
  onJump: (centerBp: number) => void
  shouldRender: boolean
}

const CLASS_COLORS_ARR = [
  AA_CLASS_COLORS.hydrophobic,
  AA_CLASS_COLORS.polar,
  AA_CLASS_COLORS.acidic,
  AA_CLASS_COLORS.basic,
  AA_CLASS_COLORS.special,
  AA_CLASS_COLORS.stop,
] as const

function rgb(c: readonly [number, number, number]) {
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`
}

export function GeneMapMinimap({
  sequence,
  length,
  viewportRef,
  widthPx,
  heightPx,
  theme,
  onJump,
  shouldRender,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const shouldRenderRef = useRef(shouldRender)
  useEffect(() => {
    shouldRenderRef.current = shouldRender
  }, [shouldRender])

  // Precompute downsampled class strip. Re-runs only when sequence/width changes.
  const strip = useMemo(() => {
    const columns = Math.max(64, Math.min(1024, widthPx))
    return { data: downsampleAaClass(sequence, columns), columns }
  }, [sequence, widthPx])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.floor(widthPx * dpr))
    canvas.height = Math.max(1, Math.floor(heightPx * dpr))
    canvas.style.width = `${widthPx}px`
    canvas.style.height = `${heightPx}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const stripHeight = heightPx * 0.55
    const stripY = (heightPx - stripHeight) / 2
    const colWidth = widthPx / strip.columns

    // Static strip (pre-rendered into an offscreen buffer for cheap redraws).
    const off = document.createElement('canvas')
    off.width = Math.floor(widthPx * dpr)
    off.height = Math.floor(stripHeight * dpr)
    const offCtx = off.getContext('2d')!
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (let c = 0; c < strip.columns; c++) {
      const cls = strip.data[c]
      offCtx.fillStyle = rgb(CLASS_COLORS_ARR[cls])
      offCtx.fillRect(c * colWidth, 0, Math.ceil(colWidth) + 1, stripHeight)
    }

    const trackBg = theme === 'dark' ? '#1a1c22' : '#f5f6fa'
    const selStroke =
      theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(15,18,25,0.7)'
    const selFill =
      theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(15,18,25,0.08)'

    const draw = () => {
      const vp = viewportRef.current
      ctx.clearRect(0, 0, widthPx, heightPx)
      ctx.fillStyle = trackBg
      ctx.fillRect(0, 0, widthPx, heightPx)
      ctx.drawImage(off, 0, stripY, widthPx, stripHeight)

      // Viewport rect
      const viewportBp = vp.bpPerPixel * widthPx
      const leftBp = Math.max(0, vp.centerBp - viewportBp / 2)
      const rightBp = Math.min(length, vp.centerBp + viewportBp / 2)
      const xL = (leftBp / length) * widthPx
      const xR = (rightBp / length) * widthPx
      const rectW = Math.max(4, xR - xL)
      ctx.fillStyle = selFill
      ctx.fillRect(xL, stripY - 2, rectW, stripHeight + 4)
      ctx.strokeStyle = selStroke
      ctx.lineWidth = 1.25
      ctx.strokeRect(xL + 0.5, stripY - 1.5, rectW - 1, stripHeight + 3)
    }

    const pump = () => {
      if (shouldRenderRef.current) draw()
      rafRef.current = requestAnimationFrame(pump)
    }
    rafRef.current = requestAnimationFrame(pump)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [strip, widthPx, heightPx, length, theme, viewportRef])

  function onPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const bp = (x / rect.width) * length
    onJump(bp)
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onPointer(e)
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) onPointer(e)
      }}
      className="cursor-pointer rounded-md"
      aria-label="Gene viewport position minimap"
    />
  )
}

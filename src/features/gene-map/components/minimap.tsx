'use client'

import { useEffect, useRef } from 'react'
import type { GeneMapPayload } from '../api/types'

interface Props {
  payload: GeneMapPayload
  startBase: number
  endBase: number
  onSeek?: (base: number) => void
}

export function Minimap({ payload, startBase, endBase, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const draw = () => {
      const w = wrapper.clientWidth
      const h = 40
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Background
      ctx.fillStyle = '#0a0c12'
      ctx.fillRect(0, 0, w, h)

      // GC heatmap strip as the ribbon
      const total = payload.isoform.codingSequenceLength
      const trackCount = payload.tracks.gc.length
      for (let x = 0; x < w; x++) {
        const baseIdx = Math.floor((x / w) * total)
        const bucket = Math.min(
          trackCount - 1,
          Math.floor(baseIdx / payload.tracks.step),
        )
        const gc = payload.tracks.gc[bucket] ?? 0.5
        const hue = Math.round(200 - gc * 140) // blue→red-ish
        ctx.fillStyle = `hsl(${hue} 55% 45%)`
        ctx.fillRect(x, 8, 1, h - 16)
      }

      // Exon boundaries
      if (payload.exonStructure?.cdsExonLengths) {
        let cursor = 0
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth = 1
        for (const len of payload.exonStructure.cdsExonLengths) {
          cursor += len
          const x = (cursor / total) * w
          ctx.beginPath()
          ctx.moveTo(x, 4)
          ctx.lineTo(x, h - 4)
          ctx.stroke()
        }
      }

      // Viewport rectangle
      const x1 = (startBase / total) * w
      const x2 = (endBase / total) * w
      ctx.fillStyle = 'rgba(120, 170, 255, 0.18)'
      ctx.fillRect(x1, 0, Math.max(2, x2 - x1), h)
      ctx.strokeStyle = 'rgba(140, 190, 255, 0.9)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(x1 + 0.5, 0.5, Math.max(2, x2 - x1) - 1, h - 1)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [payload, startBase, endBase])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!wrapperRef.current || !onSeek) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    const target = frac * payload.isoform.codingSequenceLength
    onSeek(target)
  }

  return (
    <div
      ref={wrapperRef}
      className="relative h-10 w-full cursor-pointer rounded-md border border-white/5 bg-black/30"
      onPointerDown={onPointerDown}
      aria-label="Gene minimap"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}

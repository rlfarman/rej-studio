'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { RunMutationHint } from '../types/run-metrics'

interface DnaRibbonProps {
  sequence: string
  /** Optimizer's currently-active region (start/end in bp). Suggestive — not
   * per-tick mutation truth — so the shimmer is treated as a progress hint
   * over a window, not a forensic indicator of individual mutations. */
  mutationHint?: RunMutationHint
  /** 0..1 progress through the run; drives the scanner line position. */
  progress?: number
  /** Drop the canvas entirely and render a flat strip (reduced motion). */
  reducedMotion?: boolean
  className?: string
}

// Calm palette — low chroma so four bases sit together without competing.
// All in oklch so they harmonize with the rest of the design system.
const BASE_COLORS: Record<string, string> = {
  A: 'oklch(0.78 0.06 70)',
  T: 'oklch(0.74 0.06 230)',
  G: 'oklch(0.78 0.07 145)',
  C: 'oklch(0.74 0.06 305)',
}
const FALLBACK_COLOR = 'oklch(0.7 0 0)'

export function DnaRibbon({
  sequence,
  mutationHint,
  progress,
  reducedMotion,
  className,
}: DnaRibbonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef({ sequence, mutationHint, progress })

  // Track latest props in a ref so the rAF loop can read them without
  // restarting on every prop change (which would reset the shimmer phase).
  // useLayoutEffect so the ref updates synchronously before the next paint,
  // keeping the canvas a frame in sync with the latest props.
  useLayoutEffect(() => {
    stateRef.current = { sequence, mutationHint, progress }
  }, [sequence, mutationHint, progress])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let width = 0
    let height = 0

    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(container)

    let rafId = 0
    const start = performance.now()

    const draw = (now: number) => {
      const {
        sequence: seq,
        mutationHint: hint,
        progress: prog,
      } = stateRef.current
      const t = (now - start) / 1000

      ctx.clearRect(0, 0, width, height)

      const seqLen = seq.length || 1
      // One pixel column per ~ceil(seqLen/width) bases. The base palette is
      // averaged within each column by sampling its midpoint — for any
      // realistic CDS (a few thousand bp), one sample per column reads as
      // a continuous color field at this scale.
      for (let x = 0; x < width; x++) {
        const idx = Math.min(seqLen - 1, Math.floor((x / width) * seqLen))
        const base = seq[idx]?.toUpperCase()
        ctx.fillStyle = BASE_COLORS[base ?? ''] ?? FALLBACK_COLOR
        // Subtle vertical "weave": tiny opacity wobble so the ribbon reads
        // as alive rather than a flat bar. Two cycles across the width,
        // very low amplitude.
        const weave = reducedMotion
          ? 0
          : 0.04 * Math.sin((x / width) * Math.PI * 4 + t * 0.6)
        ctx.globalAlpha = 0.78 + weave
        ctx.fillRect(x, 0, 1, height)
      }
      ctx.globalAlpha = 1

      // Mutation-hint shimmer: a soft moving glow restricted to [start, end].
      // The user reads this as "the optimizer is currently working in this
      // region" — calibrated to be felt, not stared at.
      if (!reducedMotion && hint && seqLen > 0) {
        const hintStart = Math.max(0, Math.floor((hint.start / seqLen) * width))
        const hintEnd = Math.min(width, Math.ceil((hint.end / seqLen) * width))
        const hintWidth = Math.max(2, hintEnd - hintStart)
        // Sweep position oscillates inside the hint window with a gentle
        // sin curve. Period ~3.2s — slow enough to feel breathing, not pulsing.
        const sweep = (Math.sin(t * 1.95) + 1) / 2
        const center = hintStart + sweep * hintWidth
        const glowRadius = Math.max(20, hintWidth * 0.35)
        const grad = ctx.createRadialGradient(
          center,
          height / 2,
          0,
          center,
          height / 2,
          glowRadius,
        )
        grad.addColorStop(0, 'oklch(0.95 0.18 125 / 0.55)')
        grad.addColorStop(0.6, 'oklch(0.92 0.16 125 / 0.18)')
        grad.addColorStop(1, 'oklch(0.92 0.16 125 / 0)')
        ctx.fillStyle = grad
        ctx.fillRect(hintStart, 0, hintWidth, height)
        // Hairline brackets so the active window is legible even when the
        // glow is at the far edge.
        ctx.fillStyle = 'oklch(0.9 0.14 125 / 0.45)'
        ctx.fillRect(hintStart, 0, 1, height)
        ctx.fillRect(hintEnd - 1, 0, 1, height)
      }

      // Progress scanner — a thin vertical line at progress*width. Acts as
      // a global anchor for the eye when the shimmer wanders inside its
      // window. Skipped under reduced motion (the underlying progress bar
      // already conveys the same information).
      if (!reducedMotion && typeof prog === 'number' && prog > 0) {
        const x = Math.min(width - 1, Math.floor(prog * width))
        ctx.fillStyle = 'oklch(0.95 0.02 125 / 0.7)'
        ctx.fillRect(x, 0, 1, height)
      }

      rafId = requestAnimationFrame(draw)
    }

    if (reducedMotion) {
      // One static frame is enough — no rAF loop, so no battery cost.
      draw(performance.now())
    } else {
      rafId = requestAnimationFrame(draw)
    }

    return () => {
      observer.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [reducedMotion])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-9 w-full overflow-hidden rounded-md',
        'border-border/60 border bg-[oklch(0.97_0.005_140)] dark:bg-[oklch(0.18_0.01_140)]',
        className,
      )}
      role="img"
      aria-label="Live view of the coding sequence under optimization"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}

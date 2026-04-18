'use client'

// Canvas-2D "ribbon" that conveys live optimization without overclaiming.
// Data surfaced: `frac` (0..1, real) and `sequenceLength` (for sizing). The
// scanline represents optimization progress; the halo pulses are deterministic
// positions derived from frac+length so they feel correlated with the work
// without pretending to mark specific mutated bp.
//
// Respects prefers-reduced-motion: collapses to a static gradient bar.

import { useEffect, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface DnaRibbonProps {
  /** Optimization progress, 0..1. */
  frac: number
  /** CDS length in bp — only used for aspect cues in the track density. */
  sequenceLength: number
  /** Optional view-transition-name for cross-state morphing. */
  viewTransitionName?: string
  className?: string
}

// Base palette reads from Tailwind theme variables so the ribbon tracks
// light/dark without extra wiring. Values are already resolved CSS colors
// (lab/oklch/rgb etc.) — we use them as-is.
function readThemeColor(variable: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim()
  return v || fallback
}

export function DnaRibbon({
  frac,
  sequenceLength,
  viewTransitionName,
  className,
}: DnaRibbonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fracRef = useRef(frac)
  const lengthRef = useRef(sequenceLength)

  // Sync props → refs in a layout effect so the rAF loop always reads the
  // latest values without re-running its setup effect. Writing to
  // `ref.current` during render violates React's purity rules.
  useLayoutEffect(() => {
    fracRef.current = frac
    lengthRef.current = sequenceLength
  }, [frac, sequenceLength])

  // Run once per mount — read current frac/length from refs inside the loop,
  // so prop changes don't re-run the effect (which would cancel the rAF loop
  // before any frame paints under StrictMode double-invoke).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Short-circuit to a static draw when the user prefers reduced motion.
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    let prefersReduced = mq.matches

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
    let width = 0
    let height = 0

    // The ribbon's accent intentionally matches the submit button color
    // (oklch(0.82 0.2 125), a yellow-green) rather than the theme's `--primary`
    // (blue) so the view-transition morph from the button into the ribbon
    // reads as one continuous surface. Muted/foreground still track the
    // theme so light/dark mode works.
    const primary = 'oklch(0.82 0.2 125)'
    const muted = readThemeColor('--muted', 'oklch(0.95 0 0)')
    const foreground = readThemeColor('--foreground', 'oklch(0.2 0 0)')

    function resize() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const mqListener = (e: MediaQueryListEvent) => {
      prefersReduced = e.matches
    }
    mq.addEventListener('change', mqListener)

    // Eased display frac — creeps toward the target on each frame so the
    // scanline glides instead of jumping when a new progress event lands.
    let displayFrac = fracRef.current
    // Deterministic halo seeds so pulses feel correlated with progress but
    // don't shift every render. Density scales with sqrt(length) so short and
    // long sequences both look calm. Length resolved lazily (read from ref)
    // so late hydration doesn't require a re-mount.
    const pulseCount = Math.min(
      6,
      Math.max(
        3,
        Math.round(Math.sqrt(Math.max(100, lengthRef.current) / 100)),
      ),
    )
    const seeds = Array.from({ length: pulseCount }, (_, i) => (i + 1) * 0.1337)

    let rafId = 0
    let lastTime = performance.now()

    function draw(now: number) {
      if (!canvas || !ctx) return
      const dt = Math.min(64, now - lastTime) / 1000
      lastTime = now

      const target = Math.max(0, Math.min(1, fracRef.current))
      // Ease toward target with a soft spring-ish approach — fast enough to
      // feel responsive on new checkpoints, slow enough to avoid jitter.
      const k = prefersReduced ? 1 : 1 - Math.exp(-dt * 6)
      displayFrac = displayFrac + (target - displayFrac) * k

      ctx.clearRect(0, 0, width, height)

      // Track: muted pill background.
      const pad = 1
      const trackY = height / 2
      const trackHeight = Math.max(3, height * 0.18)
      const trackTop = trackY - trackHeight / 2
      ctx.fillStyle = muted
      roundRect(
        ctx,
        pad,
        trackTop,
        width - pad * 2,
        trackHeight,
        trackHeight / 2,
      )
      ctx.fill()

      // Filled portion left of the scanline — soft, low contrast.
      const fillWidth =
        Math.max(0, Math.min(1, displayFrac)) * (width - pad * 2)
      if (fillWidth > 0) {
        const gradient = ctx.createLinearGradient(pad, 0, pad + fillWidth, 0)
        gradient.addColorStop(0, withAlpha(primary, 0.35))
        gradient.addColorStop(1, withAlpha(primary, 0.75))
        ctx.fillStyle = gradient
        roundRect(ctx, pad, trackTop, fillWidth, trackHeight, trackHeight / 2)
        ctx.fill()
      }

      // Tick marks across the track — very faint, for a "measuring" feel.
      ctx.fillStyle = withAlpha(foreground, 0.08)
      const tickCount = 10
      for (let i = 1; i < tickCount; i++) {
        const x = pad + ((width - pad * 2) * i) / tickCount
        ctx.fillRect(x, trackTop + 1, 1, trackHeight - 2)
      }

      // Scanline: a soft vertical glow at the current frac position.
      const scanX = pad + displayFrac * (width - pad * 2)
      const glowWidth = Math.min(80, width * 0.12)
      const glow = ctx.createRadialGradient(
        scanX,
        trackY,
        0,
        scanX,
        trackY,
        glowWidth,
      )
      glow.addColorStop(0, withAlpha(primary, 0.9))
      glow.addColorStop(0.3, withAlpha(primary, 0.35))
      glow.addColorStop(1, withAlpha(primary, 0))
      ctx.fillStyle = glow
      ctx.fillRect(scanX - glowWidth, 0, glowWidth * 2, height)

      // Hard line at exactly scanX — thin, high contrast against fill.
      ctx.fillStyle = withAlpha(primary, 0.95)
      ctx.fillRect(scanX - 0.5, trackTop - 3, 1, trackHeight + 6)

      // Halo pulses: synthesized positions that shimmer near the scanline.
      // Each pulse has a seed phase; intensity peaks as the scanline
      // approaches and fades as it passes. All deterministic in the seed.
      if (!prefersReduced) {
        const timeSec = now / 1000
        for (let i = 0; i < seeds.length; i++) {
          const seed = seeds[i]
          // Offset each pulse around the scanline within ±8% of width.
          const offset = Math.sin(seed * 9.37 + timeSec * 0.6) * 0.08 * width
          const px = scanX + offset
          // Intensity oscillates with a slow wave + sharp peak at proximity.
          const phase = Math.sin(timeSec * (1.4 + seed) + seed * 5) * 0.5 + 0.5
          const proximity = 1 - Math.min(1, Math.abs(offset) / (width * 0.1))
          const alpha = 0.08 + phase * proximity * 0.22
          const radius = 3 + phase * 3
          const pulse = ctx.createRadialGradient(
            px,
            trackY,
            0,
            px,
            trackY,
            radius * 3,
          )
          pulse.addColorStop(0, withAlpha(primary, alpha))
          pulse.addColorStop(1, withAlpha(primary, 0))
          ctx.fillStyle = pulse
          ctx.fillRect(
            px - radius * 3,
            trackY - radius * 3,
            radius * 6,
            radius * 6,
          )
        }
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      mq.removeEventListener('change', mqListener)
    }
    // Effect must not re-run when props change — we read the latest values
    // from refs inside the rAF loop.
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={cn('h-12 w-full', className)}
      style={viewTransitionName ? { viewTransitionName } : undefined}
      aria-hidden
    />
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

// Apply an alpha to any color string (oklch/rgb/hsl) via color-mix — falls
// back to the raw color if the browser doesn't parse the mix (rare).
function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  if (a >= 1) return color
  // color-mix is widely supported; canvas accepts it via CSS color strings.
  return `color-mix(in oklch, ${color} ${Math.round(a * 100)}%, transparent)`
}

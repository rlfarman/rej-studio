'use client'
import { useEffect, useRef } from 'react'
import { GENETIC_CODE } from '@/lib/bio/genetic-code'
import { AA_CLASS_COLORS, codonToClassIndex } from '../lib/aa-classes'
import {
  LOD_AA_FADE_IN_BP_PER_PX,
  LOD_AA_FADE_OUT_BP_PER_PX,
  LOD_BASE_FADE_IN_BP_PER_PX,
  LOD_BASE_FADE_OUT_BP_PER_PX,
  smoothstep,
} from '../lib/lod'
import type { LayerData, LayerFlags, Viewport } from '../types'

const TRANSLATE = GENETIC_CODE

const BASE_DARK: Record<string, string> = {
  A: '#9edbb9',
  C: '#8cc7fa',
  G: '#fac775',
  T: '#f492ae',
}
const BASE_LIGHT: Record<string, string> = {
  A: '#267a45',
  C: '#1e6cb8',
  G: '#b87715',
  T: '#b23959',
}

interface Props {
  layerData: LayerData
  sequence: string
  viewportRef: React.MutableRefObject<Viewport>
  layers: LayerFlags
  widthPx: number
  heightPx: number
  ribbonYPx: number
  ribbonHeightPx: number
  theme: 'light' | 'dark'
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

function rgbString(c: readonly [number, number, number], a = 1) {
  return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${a})`
}

export function GeneMapFallback({
  layerData,
  sequence,
  viewportRef,
  layers,
  widthPx,
  heightPx,
  ribbonYPx,
  ribbonHeightPx,
  theme,
  shouldRender,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const shouldRenderRef = useRef(shouldRender)
  useEffect(() => {
    shouldRenderRef.current = shouldRender
  }, [shouldRender])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, widthPx * dpr)
    canvas.height = Math.max(1, heightPx * dpr)
    canvas.style.width = `${widthPx}px`
    canvas.style.height = `${heightPx}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const upper = sequence.toUpperCase().replace(/U/g, 'T')
    const n = upper.length
    const bg = theme === 'dark' ? '#1a1c22' : '#f5f6fa'
    const altBg = theme === 'dark' ? '#23262e' : '#eceff5'

    const draw = () => {
      const vp = viewportRef.current
      const bpp = vp.bpPerPixel
      const leftBp = vp.centerBp - (widthPx / 2) * bpp
      const rightBp = vp.centerBp + (widthPx / 2) * bpp
      ctx.clearRect(0, 0, widthPx, heightPx)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, widthPx, heightPx)

      const y0 = ribbonYPx - ribbonHeightPx / 2
      const h = ribbonHeightPx
      const pxPerBp = 1 / bpp

      const firstBp = Math.max(0, Math.floor(leftBp))
      const lastBp = Math.min(n - 1, Math.ceil(rightBp))

      // Ribbon fill, one rect per base (clipped; 2D canvas handles 10k easily).
      for (let i = firstBp; i <= lastBp; i++) {
        const xPx = (i - leftBp) * pxPerBp
        const widthPxBase = Math.max(0.5, pxPerBp)
        let cls = 5
        if (i + 3 <= n) {
          cls = codonToClassIndex(upper.slice(i - (i % 3), i - (i % 3) + 3))
        }
        const classColor = CLASS_COLORS_ARR[cls]
        const fill = layers.aaClass
          ? rgbString(classColor, 0.88)
          : i % 2 === 0
            ? bg
            : altBg
        ctx.fillStyle = fill
        ctx.fillRect(xPx, y0, widthPxBase, h)
      }

      // Overlays — CpG / restriction / GC heatmap (operate on same instances).
      if (layers.cpg || layers.restriction || layers.gcHeatmap) {
        for (let i = firstBp; i <= lastBp; i++) {
          const off = i * 4
          const flags = layerData.texture[off + 1]
          const xPx = (i - leftBp) * pxPerBp
          const wPx = Math.max(0.5, pxPerBp)
          if (layers.gcHeatmap) {
            const gc = layerData.texture[off + 2] / 255
            const dev = gc - 0.5
            // Blend a cool-warm gradient row on top.
            const r = Math.round(60 + dev * 200 + 100)
            const g = Math.round(120 - Math.abs(dev) * 60)
            const b = Math.round(200 - dev * 160)
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.45)`
            ctx.fillRect(xPx, y0, wPx, h)
          }
          if (layers.cpg && (flags & 1) !== 0) {
            ctx.fillStyle = 'rgba(89, 229, 235, 0.55)'
            ctx.fillRect(xPx, y0, wPx, h)
          }
          if (layers.restriction && (flags & 2) !== 0) {
            ctx.fillStyle = 'rgba(255, 209, 69, 0.65)'
            ctx.fillRect(xPx, y0, wPx, h)
          }
        }
      }

      // Letters (aa at mid, base at near).
      const baseAlpha =
        1 -
        smoothstep(LOD_BASE_FADE_OUT_BP_PER_PX, LOD_BASE_FADE_IN_BP_PER_PX, bpp)
      const aaAlpha =
        (1 -
          smoothstep(
            LOD_AA_FADE_OUT_BP_PER_PX,
            LOD_AA_FADE_IN_BP_PER_PX,
            bpp,
          )) *
        (1 - baseAlpha)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (aaAlpha > 0.02) {
        ctx.fillStyle =
          theme === 'dark'
            ? `rgba(255,255,255,${0.85 * aaAlpha})`
            : `rgba(15,18,25,${0.85 * aaAlpha})`
        ctx.font = '600 12px ui-monospace, monospace'
        const codonW = 3 * pxPerBp
        const firstCodon = Math.max(0, Math.floor(leftBp / 3))
        const lastCodon = Math.min(
          Math.floor(n / 3) - 1,
          Math.ceil(rightBp / 3),
        )
        for (let c = firstCodon; c <= lastCodon; c++) {
          const baseIdx = c * 3
          const codon = upper.slice(baseIdx, baseIdx + 3)
          if (codon.length < 3) continue
          const cls = codonToClassIndex(codon)
          void cls
          const aa = TRANSLATE[codon] ?? '*'
          const xPx = (baseIdx - leftBp) * pxPerBp + codonW / 2
          ctx.fillText(aa, xPx, ribbonYPx)
        }
      }
      if (baseAlpha > 0.02) {
        ctx.font = '600 14px ui-monospace, monospace'
        const colors = theme === 'dark' ? BASE_DARK : BASE_LIGHT
        for (let i = firstBp; i <= lastBp; i++) {
          const xPx = (i - leftBp) * pxPerBp + pxPerBp / 2
          const b = upper[i] ?? 'N'
          ctx.fillStyle =
            colors[b as 'A' | 'C' | 'G' | 'T'] ??
            (theme === 'dark' ? '#e6e8ef' : '#1a1c22')
          ctx.globalAlpha = baseAlpha
          ctx.fillText(b, xPx, ribbonYPx)
          ctx.globalAlpha = 1
        }
      }

      ctx.fillStyle = 'transparent'
    }

    const pump = () => {
      if (shouldRenderRef.current) draw()
      rafRef.current = requestAnimationFrame(pump)
    }
    rafRef.current = requestAnimationFrame(pump)
    // Sync initial paint — rAF can be throttled in headless previews.
    draw()
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [
    layerData,
    sequence,
    layers,
    widthPx,
    heightPx,
    ribbonYPx,
    ribbonHeightPx,
    theme,
    viewportRef,
  ])

  return <canvas ref={canvasRef} aria-hidden="true" />
}

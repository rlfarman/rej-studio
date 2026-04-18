'use client'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ViewTransition,
} from 'react'
import { useTheme } from 'next-themes'
import { computeLayerData } from '../lib/layer-data'
import { geneMapCopy } from '../copy'
import {
  DEFAULT_LAYERS,
  type GeneMapIsoform,
  type LayerFlags,
  type Viewport,
} from '../types'
import { useGeneMapViewport } from '../hooks/use-gene-map-viewport'
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion'
import { GeneMapFallback } from './gene-map-fallback'
import { GeneMapControls } from './gene-map-controls'
import { GeneMapMinimap } from './gene-map-minimap'
import { IsoformSwitcher } from './isoform-switcher'
import { AA_CLASS_COLORS } from '../lib/aa-classes'
import { cn } from '@/lib/utils'

interface Props {
  isoforms: GeneMapIsoform[]
  initialIsoformId?: string
  onIsoformChange?: (id: string) => void
  className?: string
}

const CANVAS_HEIGHT = 220

export function GeneMap({
  isoforms,
  initialIsoformId,
  onIsoformChange,
  className,
}: Props) {
  const [activeId, setActiveIdState] = useState<string>(
    () => initialIsoformId ?? isoforms[0]?.id ?? '',
  )
  const setActiveId = useCallback(
    (id: string) => {
      setActiveIdState(id)
      onIsoformChange?.(id)
    },
    [onIsoformChange],
  )

  useEffect(() => {
    if (!initialIsoformId) return
    if (
      initialIsoformId !== activeId &&
      isoforms.some((i) => i.id === initialIsoformId)
    ) {
      setActiveIdState(initialIsoformId)
    }
  }, [initialIsoformId, activeId, isoforms])

  const active = useMemo(
    () => isoforms.find((i) => i.id === activeId) ?? isoforms[0],
    [isoforms, activeId],
  )

  const [layers, setLayers] = useState<LayerFlags>(DEFAULT_LAYERS)
  const reducedMotion = usePrefersReducedMotion()
  const { theme, resolvedTheme } = useTheme()
  const activeTheme: 'light' | 'dark' =
    resolvedTheme === 'dark' || theme === 'dark' ? 'dark' : 'light'

  // Layer data memoized on the active sequence.
  const layerData = useMemo(
    () => (active ? computeLayerData(active.codingSequence) : null),
    [active],
  )

  // Container size tracking.
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: CANVAS_HEIGHT })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      setSize({ w: Math.max(200, rect.width), h: CANVAS_HEIGHT })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Visibility / offscreen gating.
  const [inView, setInView] = useState(true)
  const [tabVisible, setTabVisible] = useState(true)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting)),
      { threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const shouldRender = inView && tabVisible

  // Viewport.
  const length = active?.codingSequenceLength ?? 1
  const { rendered, viewport, setTarget, zoomBy, panByPx, fit } =
    useGeneMapViewport({
      length,
      widthPx: size.w,
      reducedMotion,
    })

  // Expose the latest rendered viewport to the canvas via a ref so it can
  // read inside its own rAF pump without re-renders.
  const viewportRef = useRef<Viewport>(rendered)
  useEffect(() => {
    viewportRef.current = rendered
  }, [rendered])

  // Pointer panning.
  const pointerStateRef = useRef<{
    active: boolean
    lastX: number
    pointerId: number
  }>({ active: false, lastX: 0, pointerId: -1 })
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    pointerStateRef.current = {
      active: true,
      lastX: e.clientX,
      pointerId: e.pointerId,
    }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = pointerStateRef.current
    if (!s.active || e.pointerId !== s.pointerId) return
    const dx = e.clientX - s.lastX
    s.lastX = e.clientX
    panByPx(dx)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = pointerStateRef.current
    if (e.pointerId !== s.pointerId) return
    s.active = false
    try {
      ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  // Wheel: pinch-zoom (ctrl/meta key or deltaZ present) + pan with dx.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Always prevent document scroll when the pointer is over the map.
    e.preventDefault()
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const anchor = e.clientX - rect.left
    if (e.ctrlKey || e.metaKey) {
      // Pinch gesture on trackpad: Safari + Chrome emit ctrlKey:true on wheel.
      const factor = Math.exp(e.deltaY * 0.01)
      zoomBy(factor, anchor)
      return
    }
    // Horizontal pan by deltaX if present, otherwise treat vertical as pan.
    const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY
    panByPx(-dx)
  }

  // Keyboard shortcuts on focus.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault()
        zoomBy(0.7)
        break
      case '-':
      case '_':
        e.preventDefault()
        zoomBy(1.4)
        break
      case '0':
        e.preventDefault()
        fit()
        break
      case 'ArrowLeft':
        e.preventDefault()
        panByPx(size.w * 0.18)
        break
      case 'ArrowRight':
        e.preventDefault()
        panByPx(-size.w * 0.18)
        break
      case 'Home':
        e.preventDefault()
        setTarget({ centerBp: (viewport.bpPerPixel * size.w) / 2 })
        break
      case 'End':
        e.preventDefault()
        setTarget({ centerBp: length - (viewport.bpPerPixel * size.w) / 2 })
        break
    }
  }

  const ribbonY = CANVAS_HEIGHT / 2
  const ribbonHeight = 110

  if (!active) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">
        {geneMapCopy.emptyState}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <ViewTransition name={`isoform-map-${active.id}`}>
            <span className="bg-muted/50 inline-flex items-center rounded-md border px-2 py-1 font-mono text-xs">
              {active.id}
            </span>
          </ViewTransition>
          <IsoformSwitcher
            isoforms={isoforms}
            value={active.id}
            onValueChange={setActiveId}
          />
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {geneMapCopy.subheading(active.codingSequenceLength)}
          </span>
        </div>
        <GeneMapControls
          layers={layers}
          onLayerChange={setLayers}
          onZoomIn={() => zoomBy(0.7)}
          onZoomOut={() => zoomBy(1.4)}
          onFit={fit}
        />
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        role="application"
        aria-label="Gene map viewer"
        className="focus-visible:ring-ring bg-background/40 relative touch-none overflow-hidden rounded-lg border select-none focus-visible:ring-2 focus-visible:outline-none"
        style={{ height: CANVAS_HEIGHT, cursor: 'grab' }}
        onPointerDown={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.cursor = 'grabbing'
          onPointerDown(e)
        }}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.cursor = 'grab'
          onPointerUp(e)
        }}
        onPointerCancel={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.cursor = 'grab'
          onPointerUp(e)
        }}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        {layerData && (
          <GeneMapFallback
            layerData={layerData}
            sequence={active.codingSequence}
            viewportRef={viewportRef}
            layers={layers}
            widthPx={size.w}
            heightPx={size.h}
            ribbonYPx={ribbonY}
            ribbonHeightPx={ribbonHeight}
            theme={activeTheme}
            shouldRender={shouldRender}
          />
        )}
        <PositionBadge viewport={rendered} width={size.w} length={length} />
      </div>

      <GeneMapMinimap
        sequence={active.codingSequence}
        length={length}
        viewportRef={viewportRef}
        widthPx={size.w}
        heightPx={28}
        theme={activeTheme}
        onJump={(bp) => setTarget({ centerBp: bp })}
        shouldRender={shouldRender}
      />

      <Legend />
    </div>
  )
}

function PositionBadge({
  viewport,
  width,
  length,
}: {
  viewport: Viewport
  width: number
  length: number
}) {
  const leftBp = Math.max(
    0,
    Math.floor(viewport.centerBp - (viewport.bpPerPixel * width) / 2),
  )
  const rightBp = Math.min(
    length,
    Math.ceil(viewport.centerBp + (viewport.bpPerPixel * width) / 2),
  )
  return (
    <div className="bg-background/85 text-muted-foreground pointer-events-none absolute top-2 right-2 rounded-md border px-2 py-1 font-mono text-[10px] tabular-nums backdrop-blur">
      {geneMapCopy.range(leftBp + 1, rightBp)}
    </div>
  )
}

function Legend() {
  const c = geneMapCopy.legend
  const items: [string, [number, number, number]][] = [
    [c.hydrophobic, AA_CLASS_COLORS.hydrophobic],
    [c.polar, AA_CLASS_COLORS.polar],
    [c.acidic, AA_CLASS_COLORS.acidic],
    [c.basic, AA_CLASS_COLORS.basic],
    [c.special, AA_CLASS_COLORS.special],
    [c.stop, AA_CLASS_COLORS.stop],
  ]
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
      <span className="font-mono tracking-wide uppercase">{c.title}</span>
      {items.map(([label, rgb]) => (
        <span key={label} className="inline-flex items-center gap-1">
          <span
            className="size-2.5 rounded-sm"
            style={{
              background: `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`,
            }}
            aria-hidden="true"
          />
          {label}
        </span>
      ))}
    </div>
  )
}

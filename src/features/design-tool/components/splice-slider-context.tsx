'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  findWggwMotifs,
  slidingGcContent,
  rankWggwByBalance,
  computeGcPercent,
  assessFragmentBalance,
} from '@/lib/bio/sequence-utils'
import { translateCodon, AMINO_ACID_NAMES } from '@/lib/bio/genetic-code'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Keyboard } from 'lucide-react'
import { AAV_OVERHEAD_BP, AAV_PACKAGING_LIMIT } from '@/lib/bio/aav'

interface Props {
  sequence: string
  position: number
  onSnap: (position: number) => void
}

const MAX_WGGW_MARKERS = 200
const MIN_CONTEXT_WINDOW = 6 // minimum codons on each side of the split
const MAX_CONTEXT_WINDOW = 30 // cap to keep text readable
const PX_PER_CODON = 28 // approximate minimum width for a 3-base codon box

/**
 * Context strip that sits directly under the splice-junction slider. It
 * surfaces raw, defensible measurements for the current cut rather than
 * combining them into an arbitrary composite score:
 *
 * - Drag-to-set GC micro-profile with the 40–60% reference band
 * - WGGW ticks aligned to the slider, snappable on click
 * - Balanced WGGW candidates — every motif in the sequence ranked by
 *   distance from a 50/50 split (single criterion: fragment balance)
 * - Per-fragment length, GC%, and AAV fit (hard ~4.7kb packaging limit)
 * - Codon-level frame-at-split readout with ±6 codons of context
 */
export function SpliceSliderContext({ sequence, position, onSnap }: Props) {
  const seqLen = sequence.length
  const trackRef = useRef<HTMLDivElement>(null)

  const { gcPoints, wggwMotifs, nearestWggw, balancedWggw } = useMemo(() => {
    if (seqLen < 12) {
      return {
        gcPoints: [],
        wggwMotifs: [],
        nearestWggw: null,
        balancedWggw: [],
      }
    }
    // Window scales with sequence length: bigger windows for long CDSs,
    // tighter windows for short ones. 30–120bp range feels sensible.
    const window = Math.min(120, Math.max(30, Math.round(seqLen / 40)))
    const step = Math.max(1, Math.round(window / 6))
    const gcPoints = slidingGcContent(sequence, window, step)

    const motifs = findWggwMotifs(sequence).slice(0, MAX_WGGW_MARKERS)

    // Nearest WGGW to the current cut, for the "snap to nearest" button.
    let nearest: {
      position: number
      motif: string
      distance: number
    } | null = null
    for (const m of motifs) {
      const mid = m.position + 1
      const d = Math.abs(mid - position)
      if (!nearest || d < nearest.distance) {
        nearest = { position: mid, motif: m.motif, distance: d }
      }
    }

    const balancedWggw = rankWggwByBalance(sequence).slice(0, 3)

    return { gcPoints, wggwMotifs: motifs, nearestWggw: nearest, balancedWggw }
  }, [sequence, seqLen, position])

  const fragmentStats = useMemo(() => {
    if (seqLen < 2) return null
    const fiveSeq = sequence.slice(0, position)
    const threeSeq = sequence.slice(position)
    return {
      five: {
        length: fiveSeq.length,
        gc: computeGcPercent(fiveSeq.toUpperCase()),
        aavTotal: fiveSeq.length + AAV_OVERHEAD_BP,
      },
      three: {
        length: threeSeq.length,
        gc: computeGcPercent(threeSeq.toUpperCase()),
        aavTotal: threeSeq.length + AAV_OVERHEAD_BP,
      },
    }
  }, [sequence, position, seqLen])

  const [contextWindow, setContextWindow] = useState(MIN_CONTEXT_WINDOW)
  const frameStripRef = useRef<HTMLDivElement>(null)

  // Measure the strip and fit as many codons as possible within MIN/MAX bounds.
  useEffect(() => {
    const el = frameStripRef.current
    if (!el) return
    const update = () => {
      const width = el.clientWidth
      if (width <= 0) return
      const fit = Math.floor(width / PX_PER_CODON)
      // Total codons = 2*window + 1 ≤ fit → window ≤ (fit - 1) / 2.
      // On narrow viewports this can fall below MIN_CONTEXT_WINDOW; shrink
      // below the preferred minimum rather than overflow the container.
      const raw = Math.floor((fit - 1) / 2)
      setContextWindow(Math.max(1, Math.min(MAX_CONTEXT_WINDOW, raw)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const frameContext = useMemo(() => {
    return buildFrameContext(sequence, position, contextWindow)
  }, [sequence, position, contextWindow])

  if (seqLen < 12) return null

  // Build the GC polyline path within a fixed-height SVG (viewBox 100x20).
  // We output a normalized x in [0,100] and y flipped so higher GC goes up.
  const pathData = gcPoints
    .map((p, i) => {
      const x = (p.position / (seqLen - 1)) * 100
      const y = 20 - (p.gc / 100) * 20
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  const positionPct = (position / seqLen) * 100
  const candidateSet = new Set(balancedWggw.map((c) => c.position))

  // Drag-to-set: convert pointer X to a 1..seqLen-1 position.
  const positionFromPointer = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return position
    const rect = track.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const frac = rect.width > 0 ? x / rect.width : 0
    return Math.max(1, Math.min(seqLen - 1, Math.round(frac * seqLen)))
  }

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Let WGGW tick buttons handle their own clicks.
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    target.focus()
    onSnap(positionFromPointer(e.clientX))
    const handleMove = (ev: PointerEvent) => {
      onSnap(positionFromPointer(ev.clientX))
    }
    const handleUp = () => {
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId)
      }
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)
      target.removeEventListener('pointercancel', handleUp)
    }
    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
    target.addEventListener('pointercancel', handleUp)
  }

  const handleTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Alt/Option = step by whole codon (3 bp). Shift = ×10.
    const step = e.altKey ? 3 : 1
    const big = (e.shiftKey ? 10 : 1) * step
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onSnap(position - big)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onSnap(position + big)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onSnap(1)
    } else if (e.key === 'End') {
      e.preventDefault()
      onSnap(seqLen - 1)
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      onSnap(position - Math.max(1, Math.round(seqLen / 20)))
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      onSnap(position + Math.max(1, Math.round(seqLen / 20)))
    }
  }

  const fivePrimeLength = fragmentStats?.five.length ?? 0
  const threePrimeLength = fragmentStats?.three.length ?? 0
  const fivePct = (fivePrimeLength / seqLen) * 100

  // AAV capacity zones: which slider positions yield fragments that fit the
  // ~4.7 kb packaging limit once ITR/promoter overhead is added. Surfaced
  // proactively as a thin stripe above the fragment bar so users can see
  // safe regions at a glance before committing to a cut.
  const maxPayload = AAV_PACKAGING_LIMIT - AAV_OVERHEAD_BP
  const tightPayload = AAV_PACKAGING_LIMIT + 300 - AAV_OVERHEAD_BP
  const safeLeft = Math.max(1, seqLen - maxPayload)
  const safeRight = Math.min(seqLen - 1, maxPayload)
  const tightLeft = Math.max(1, seqLen - tightPayload)
  const tightRight = Math.min(seqLen - 1, tightPayload)
  const hasSafeZone = safeLeft <= safeRight
  const showAavZones = seqLen > maxPayload

  // Split-level warnings surfaced inside the slider itself. Thresholds mirror
  // the AAV zone stripe above the fragment bar and FragmentPill's tight/exceeds
  // labels: ≤limit = fits (green), ≤limit+300 = tight (yellow, warn), over = red (error).
  const balance = assessFragmentBalance(position, seqLen)
  const TIGHT_LIMIT = AAV_PACKAGING_LIMIT + 300
  const fiveTotal = fragmentStats?.five.aavTotal ?? 0
  const threeTotal = fragmentStats?.three.aavTotal ?? 0
  const fiveExceeds = fiveTotal > TIGHT_LIMIT
  const threeExceeds = threeTotal > TIGHT_LIMIT
  const fiveTight = !fiveExceeds && fiveTotal > AAV_PACKAGING_LIMIT
  const threeTight = !threeExceeds && threeTotal > AAV_PACKAGING_LIMIT
  const warnings: { level: 'warn' | 'error'; message: string }[] = []
  if (fiveExceeds || threeExceeds) {
    const which = [fiveExceeds && '5′', threeExceeds && '3′']
      .filter(Boolean)
      .join(' & ')
    warnings.push({
      level: 'error',
      message: `${which} fragment + AAV overhead exceeds ~${AAV_PACKAGING_LIMIT.toLocaleString()} bp packaging limit.`,
    })
  } else if (fiveTight || threeTight) {
    const which = [fiveTight && '5′', threeTight && '3′']
      .filter(Boolean)
      .join(' & ')
    warnings.push({
      level: 'warn',
      message: `${which} fragment + AAV overhead is tight (within 300 bp of the ~${AAV_PACKAGING_LIMIT.toLocaleString()} bp packaging limit).`,
    })
  }
  if (balance === 'imbalanced') {
    warnings.push({
      level: 'error',
      message:
        'Fragments are highly imbalanced — consider a more centered split.',
    })
  } else if (balance === 'moderate' && warnings.length === 0) {
    warnings.push({
      level: 'warn',
      message: 'Fragments are moderately imbalanced.',
    })
  }
  // Splice-junction proximity to start/stop codon
  const MIN_MARGIN = 150
  if (seqLen > MIN_MARGIN * 2) {
    if (position < MIN_MARGIN) {
      warnings.push({
        level: 'warn',
        message: `Splice junction is within ${MIN_MARGIN} bp of the start codon — very little 5′ fragment for stable expression.`,
      })
    }
    if (seqLen - position < MIN_MARGIN) {
      warnings.push({
        level: 'warn',
        message: `Splice junction is within ${MIN_MARGIN} bp of the stop codon — very little 3′ fragment for stable expression.`,
      })
    }
  }

  return (
    <div className="space-y-2">
      {/* Unified composite slider: viz bar + GC profile + WGGW ticks.
          Drag anywhere, arrow keys to nudge, Home/End to jump to ends. */}
      <div className="space-y-1">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Splice junction position"
          aria-valuemin={1}
          aria-valuemax={seqLen - 1}
          aria-valuenow={position}
          aria-valuetext={`bp ${position.toLocaleString()} of ${seqLen.toLocaleString()}`}
          onPointerDown={handleTrackPointerDown}
          onKeyDown={handleTrackKeyDown}
          className="focus-visible:ring-ring relative cursor-ew-resize touch-none rounded-md border select-none focus:outline-none focus-visible:ring-2"
        >
          {/* AAV capacity zones: green = both fragments fit, yellow = tight,
              red = over ~4.7 kb packaging limit. Hidden for sequences that
              already fit as a monomer. */}
          {showAavZones && (
            <div
              className="relative h-1.5 w-full overflow-hidden rounded-t-[5px]"
              aria-hidden="true"
              title="AAV packaging zones: green fits, yellow tight, red over limit"
            >
              <div className="bg-destructive/25 absolute inset-0" />
              <div
                className="absolute inset-y-0 bg-yellow-400/40"
                style={{
                  left: `${(tightLeft / seqLen) * 100}%`,
                  right: `${((seqLen - tightRight) / seqLen) * 100}%`,
                }}
              />
              {hasSafeZone && (
                <div
                  className="absolute inset-y-0 bg-emerald-500/40"
                  style={{
                    left: `${(safeLeft / seqLen) * 100}%`,
                    right: `${((seqLen - safeRight) / seqLen) * 100}%`,
                  }}
                />
              )}
            </div>
          )}
          {/* Top lane: 5′/3′ fragment bar */}
          <div
            className={cn(
              'relative flex h-7 w-full overflow-hidden',
              !showAavZones && 'rounded-t-[5px]',
            )}
          >
            <div
              className="bg-primary/15 flex min-w-0 items-center justify-center"
              style={{ width: `${fivePct}%` }}
            >
              <span className="text-primary pointer-events-none truncate px-1.5 text-xs font-medium">
                5′ · {fivePrimeLength.toLocaleString()} bp
              </span>
            </div>
            <div className="bg-muted/50 flex min-w-0 flex-1 items-center justify-center">
              <span className="text-muted-foreground pointer-events-none truncate px-1.5 text-xs font-medium">
                3′ · {threePrimeLength.toLocaleString()} bp
              </span>
            </div>
            {/* 40/60 balance target band — visual hint for the "balanced" range */}
            <div
              className="pointer-events-none absolute inset-y-0 border-x border-dashed border-emerald-500/50"
              style={{ left: '40%', width: '20%' }}
              aria-hidden="true"
              title="Balanced split range (40–60%)"
            />
          </div>
          {/* Middle lane: GC profile */}
          <svg
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
            className="bg-muted/20 block h-8 w-full"
            aria-hidden="true"
          >
            {/* 40-60% reference band */}
            <rect
              x={0}
              y={20 - (60 / 100) * 20}
              width={100}
              height={((60 - 40) / 100) * 20}
              className="fill-emerald-500/10"
            />
            {/* 50% reference line */}
            <line
              x1={0}
              x2={100}
              y1={10}
              y2={10}
              className="stroke-muted-foreground/30"
              strokeWidth={0.3}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2 2"
            />
            {/* GC polyline */}
            {pathData && (
              <path
                d={pathData}
                className="stroke-primary fill-none"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {/* Bottom lane: WGGW ticks */}
          <div className="bg-muted/30 relative h-3 w-full rounded-b-[5px]">
            {wggwMotifs.map((m, i) => {
              const mid = m.position + 1
              const x = (mid / seqLen) * 100
              const isNearest =
                nearestWggw !== null && nearestWggw.position === mid
              const isCandidate = candidateSet.has(mid)
              return (
                <button
                  type="button"
                  key={`${mid}-${i}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSnap(mid)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title={`WGGW ${m.motif} at bp ${m.position}–${m.position + 3} · snap`}
                  className="group absolute top-0 flex h-full w-3 -translate-x-1/2 cursor-pointer items-stretch justify-center"
                  style={{ left: `${x}%` }}
                >
                  <span
                    className={cn(
                      'rounded-sm transition-all',
                      'group-hover:w-[3px] group-hover:bg-emerald-400',
                      isCandidate
                        ? 'w-[2px] bg-amber-500'
                        : isNearest
                          ? 'w-[2px] bg-emerald-500'
                          : 'w-[1px] bg-emerald-500/60',
                    )}
                  />
                </button>
              )
            })}
          </div>
          {/* Current position indicator spanning all three lanes */}
          <div
            className="border-foreground pointer-events-none absolute inset-y-0 w-0 border-l-2"
            style={{ left: `${positionPct}%` }}
            aria-hidden="true"
          />
        </div>
        {/* Single readout */}
        <div className="text-muted-foreground flex items-center justify-between gap-2 text-[10px]">
          <span className="font-mono tabular-nums">
            bp {position.toLocaleString()} ·{' '}
            {Math.round((fivePrimeLength / seqLen) * 100)}/
            {Math.round((threePrimeLength / seqLen) * 100)} 5′/3′
            {nearestWggw && (
              <>
                {' · nearest WGGW '}
                {nearestWggw.distance === 0
                  ? 'on cut'
                  : `${nearestWggw.position > position ? '+' : '−'}${nearestWggw.distance} bp`}
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <span>WGGW: {wggwMotifs.length}</span>
            <KeyboardHelp />
          </span>
        </div>
        {/* Inline split warnings — moved here from the diagnostics badges */}
        {warnings.length > 0 && (
          <div className="space-y-0.5">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px]',
                  w.level === 'error'
                    ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                )}
              >
                <span aria-hidden="true">
                  {w.level === 'error' ? '⚠' : '!'}
                </span>
                {w.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Balanced WGGW candidates — ranked by one criterion: |pos − len/2| */}
      {balancedWggw.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span
            className="text-muted-foreground"
            title="WGGW motifs ranked by distance from a 50/50 split"
          >
            Balanced WGGW motifs:
          </span>
          {balancedWggw.map((c, i) => {
            const isCurrent = Math.abs(c.position - position) <= 1
            const fiveAav = c.fivePrimeLength + AAV_OVERHEAD_BP
            const threeAav = c.threePrimeLength + AAV_OVERHEAD_BP
            const bothFit =
              fiveAav <= AAV_PACKAGING_LIMIT && threeAav <= AAV_PACKAGING_LIMIT
            return (
              <button
                type="button"
                key={c.position}
                onClick={() => onSnap(c.position)}
                title={`${c.motif} at bp ${c.position.toLocaleString()} · 5′ ${c.fivePrimeLength.toLocaleString()} bp · 3′ ${c.threePrimeLength.toLocaleString()} bp · ${c.distanceFromCenter.toLocaleString()} bp from center`}
                className={cn(
                  'rounded-sm border px-1.5 py-0.5 font-mono tabular-nums transition-colors',
                  isCurrent
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:border-primary/60 hover:text-foreground text-muted-foreground',
                )}
              >
                #{i + 1} {c.motif}@{c.position.toLocaleString()}
                {!bothFit && (
                  <span
                    className="ml-1 text-red-600 dark:text-red-400"
                    title="One fragment + AAV overhead exceeds ~4,700 bp"
                  >
                    ⚠
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Per-fragment readout — length, GC%, AAV fit */}
      {fragmentStats && (
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <FragmentPill
            label="5′"
            length={fragmentStats.five.length}
            gc={fragmentStats.five.gc}
            aavTotal={fragmentStats.five.aavTotal}
          />
          <FragmentPill
            label="3′"
            length={fragmentStats.three.length}
            gc={fragmentStats.three.gc}
            aavTotal={fragmentStats.three.aavTotal}
          />
        </div>
      )}

      {/* Frame-at-split readout */}
      <FrameAtSplit
        ctx={frameContext}
        position={position}
        onSnap={onSnap}
        stripRef={frameStripRef}
        wggwMotifs={wggwMotifs}
      />
    </div>
  )
}

function FragmentPill({
  label,
  length,
  gc,
  aavTotal,
}: {
  label: string
  length: number
  gc: number
  aavTotal: number
}) {
  const fits = aavTotal <= AAV_PACKAGING_LIMIT
  const tight = !fits && aavTotal <= AAV_PACKAGING_LIMIT + 300
  const fitLabel = fits ? 'fits' : tight ? 'tight' : 'exceeds'
  const fitColor = fits
    ? 'text-emerald-600 dark:text-emerald-400'
    : tight
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'
  return (
    <div
      className="bg-muted/30 flex items-center justify-between gap-2 rounded-sm border px-2 py-1"
      title={`${label} fragment: ${length.toLocaleString()} bp + ${AAV_OVERHEAD_BP.toLocaleString()} bp overhead = ${aavTotal.toLocaleString()} bp (AAV limit ${AAV_PACKAGING_LIMIT.toLocaleString()} bp)`}
    >
      <span className="text-muted-foreground font-medium">{label}</span>
      <div className="flex items-center gap-2 font-mono tabular-nums">
        <span className="text-foreground">{length.toLocaleString()} bp</span>
        <span className="text-muted-foreground">{gc.toFixed(0)}% GC</span>
        <span className={cn('font-medium', fitColor)} title="AAV packaging">
          {fitLabel}
        </span>
      </div>
    </div>
  )
}

function roleStylesFor(role: CodonRole): {
  container: string
  aa: string
  base: string
} {
  switch (role) {
    case 'split':
      return {
        container: 'bg-primary/15 ring-primary/40 ring-1',
        aa: 'text-primary font-semibold',
        base: 'text-foreground',
      }
    case 'start':
      return {
        container: 'bg-emerald-500/15 ring-emerald-500/40 ring-1',
        aa: 'text-emerald-700 dark:text-emerald-300 font-semibold',
        base: 'text-emerald-700 dark:text-emerald-300',
      }
    case 'stop':
      return {
        container: 'bg-red-500/15 ring-red-500/40 ring-1',
        aa: 'text-red-700 dark:text-red-300 font-semibold',
        base: 'text-red-700 dark:text-red-300',
      }
    case 'internal-stop':
      return {
        container: 'bg-red-500/20 ring-red-500/50 ring-1',
        aa: 'text-red-700 dark:text-red-300 font-semibold',
        base: 'text-red-700 dark:text-red-300',
      }
    default:
      return {
        container: '',
        aa: 'text-muted-foreground/70',
        base: 'text-muted-foreground',
      }
  }
}

function roleLabelFor(role: CodonRole): string | null {
  switch (role) {
    case 'start':
      return 'start codon'
    case 'stop':
      return 'stop codon'
    case 'internal-stop':
      return 'premature stop'
    default:
      return null
  }
}

type CodonRole = 'start' | 'stop' | 'internal-stop' | 'split' | 'context'

interface FrameContext {
  /** Codon index (0-based) being bisected. */
  splitCodon: number
  /** 0, 1, or 2 — byte offset of the cut within the split codon. */
  frameOffset: number
  /** Codons surrounding the split (indices splitCodon-N … splitCodon+N). */
  codons: {
    codon: string
    aa: string | null
    idx: number
    isSplit: boolean
    role: CodonRole
  }[]
}

function buildFrameContext(
  sequence: string,
  position: number,
  contextWindow: number,
): FrameContext {
  const upper = sequence.toUpperCase().replace(/U/g, 'T')
  // position is 1-based cut index: the cut falls *before* base at `position`.
  // Convert to 0-based cut index.
  const cut = Math.max(0, position - 1)
  const splitCodon = Math.floor(cut / 3)
  const frameOffset = cut % 3
  const totalCodons = Math.floor(upper.length / 3)
  const lastCodonIdx = totalCodons - 1

  let start = Math.max(0, splitCodon - contextWindow)
  let end = Math.min(totalCodons, splitCodon + contextWindow + 1)
  // Rebalance if the split is near either end so we still show a full window.
  const wanted = contextWindow * 2 + 1
  if (end - start < wanted) {
    if (start === 0) end = Math.min(totalCodons, start + wanted)
    else if (end === totalCodons) start = Math.max(0, end - wanted)
  }

  const codons: FrameContext['codons'] = []
  for (let i = start; i < end; i++) {
    const codon = upper.slice(i * 3, i * 3 + 3)
    const aa = codon.length === 3 ? translateCodon(codon) : null
    const isSplit = i === splitCodon
    let role: CodonRole = 'context'
    if (isSplit) role = 'split'
    else if (i === 0) role = 'start'
    else if (i === lastCodonIdx && aa === '*') role = 'stop'
    else if (aa === '*') role = 'internal-stop'
    codons.push({ codon, aa, idx: i, isSplit, role })
  }

  return { splitCodon, frameOffset, codons }
}

function FrameAtSplit({
  ctx,
  position,
  onSnap,
  stripRef,
  wggwMotifs,
}: {
  ctx: FrameContext
  position: number
  onSnap: (position: number) => void
  stripRef: React.RefObject<HTMLDivElement | null>
  wggwMotifs: { position: number; motif: string }[]
}) {
  // 1-based base positions belonging to any WGGW motif (each motif spans 4 bp).
  const wggwBases = useMemo(() => {
    const s = new Set<number>()
    for (const m of wggwMotifs) {
      for (let k = 0; k < 4; k++) s.add(m.position + k)
    }
    return s
  }, [wggwMotifs])

  // Pick the WGGW cut nearest a codon's base range, if any overlap. Used so
  // clicking a WGGW-highlighted codon snaps to the motif's midpoint cut
  // (consistent with clicking the tick above) rather than the codon start.
  const wggwCutForCodon = (codonIdx: number): number | null => {
    const codonStart = codonIdx * 3 + 1 // 1-based
    const codonEnd = codonStart + 2
    let best: { cut: number; dist: number } | null = null
    for (const m of wggwMotifs) {
      const motifStart = m.position
      const motifEnd = m.position + 3
      if (motifEnd < codonStart || motifStart > codonEnd) continue
      const cut = m.position + 1 // midpoint cut (same as the tick)
      const center = codonStart + 1
      const d = Math.abs(cut - center)
      if (!best || d < best.dist) best = { cut, dist: d }
    }
    return best ? best.cut : null
  }
  const splitCodon = ctx.codons.find((c) => c.isSplit)
  const aaName =
    splitCodon?.aa && AMINO_ACID_NAMES[splitCodon.aa]
      ? AMINO_ACID_NAMES[splitCodon.aa]
      : null

  const frameLabel =
    ctx.frameOffset === 0
      ? 'between codons'
      : ctx.frameOffset === 1
        ? 'after base 1'
        : 'after base 2'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">
          Frame at split · codon {ctx.splitCodon + 1}
          {splitCodon?.aa && (
            <>
              {' '}
              <span className="text-foreground font-mono">
                {splitCodon.codon}
              </span>
              {aaName && splitCodon.aa !== '*' && (
                <span className="text-muted-foreground">
                  {' '}
                  = {aaName} ({splitCodon.aa})
                </span>
              )}
              {splitCodon.aa === '*' && (
                <span className="text-red-600 dark:text-red-400"> = stop</span>
              )}
            </>
          )}
        </span>
        <span className="text-muted-foreground font-mono">
          cut {frameLabel} · bp {position.toLocaleString()}
        </span>
      </div>
      <div
        ref={stripRef}
        className="bg-muted/40 rounded-sm border p-1.5 font-mono text-[10px] leading-none"
        role="img"
        aria-label="Codon context around splice junction"
      >
        <div className="flex w-full items-center gap-[1px]">
          {ctx.codons.map((c) => {
            const roleStyles = roleStylesFor(c.role)
            const roleLabel = roleLabelFor(c.role)
            const wggwCut = wggwCutForCodon(c.idx)
            const snapTarget = wggwCut ?? c.idx * 3 + 1
            const snapLabel = wggwCut
              ? `WGGW midpoint (bp ${wggwCut.toLocaleString()})`
              : `codon start (bp ${(c.idx * 3 + 1).toLocaleString()})`
            return (
              <button
                type="button"
                key={c.idx}
                onClick={() => onSnap(snapTarget)}
                title={`${roleLabel ? roleLabel + ' · ' : ''}codon ${c.idx + 1}${c.aa ? ` (${c.codon} = ${c.aa})` : ''} · snap cut to ${snapLabel}`}
                className={cn(
                  'hover:bg-primary/10 hover:ring-primary/30 flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-sm px-[3px] py-1 transition-colors hover:ring-1',
                  roleStyles.container,
                )}
              >
                <span className={cn('tabular-nums', roleStyles.aa)}>
                  {c.aa ?? '·'}
                </span>
                <span className="flex">
                  {[0, 1, 2].map((bi) => {
                    const base = c.codon[bi]
                    const basePos = c.idx * 3 + bi + 1 // 1-based
                    const isCutBase =
                      c.isSplit &&
                      ((ctx.frameOffset === 1 && bi === 0) ||
                        (ctx.frameOffset === 2 && bi === 1))
                    const inWggw = wggwBases.has(basePos)
                    return (
                      <span
                        key={bi}
                        className={cn(
                          roleStyles.base,
                          inWggw &&
                            'border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-300',
                          isCutBase && 'border-primary border-r-2',
                        )}
                      >
                        {base ?? '·'}
                      </span>
                    )
                  })}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function KeyboardHelp() {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label="Keyboard shortcuts"
        className="hover:text-foreground text-muted-foreground rounded-sm p-0.5 transition-colors"
      >
        <Keyboard className="size-3" />
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto p-2 text-[10px]">
        <div className="mb-1 text-[10px] font-medium">Keyboard shortcuts</div>
        <div className="space-y-0.5 font-mono">
          <ShortcutRow keys={['←', '→']} desc="nudge ±1 bp" />
          <ShortcutRow keys={['⇧', '←/→']} desc="±10 bp" />
          <ShortcutRow keys={['⌥', '←/→']} desc="±1 codon" />
          <ShortcutRow keys={['⌥⇧', '←/→']} desc="±10 codons" />
          <ShortcutRow keys={['PgUp', 'PgDn']} desc="±5%" />
          <ShortcutRow keys={['Home', 'End']} desc="jump to ends" />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="bg-muted border-border rounded border px-1 py-0.5 text-[9px] leading-none"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span className="text-muted-foreground">{desc}</span>
    </div>
  )
}

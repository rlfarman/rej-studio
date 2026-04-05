'use client'

import { useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  findWggwMotifs,
  slidingGcContent,
  localGcAt,
  rankWggwByBalance,
  computeGcPercent,
} from '@/lib/bio/sequence-utils'
import { translateCodon, AMINO_ACID_NAMES } from '@/lib/bio/genetic-code'
import { AAV_OVERHEAD_BP, AAV_PACKAGING_LIMIT } from './aav-size-estimator'

interface Props {
  sequence: string
  position: number
  onSnap: (position: number) => void
}

const MAX_WGGW_MARKERS = 200
const CONTEXT_WINDOW = 6 // codons of context on each side of the split
const LOCAL_GC_WINDOW = 40 // bp window for "local GC at cut"

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
  const svgRef = useRef<SVGSVGElement>(null)

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

  const frameContext = useMemo(() => {
    return buildFrameContext(sequence, position)
  }, [sequence, position])

  const localGc = useMemo(
    () => localGcAt(sequence, position, LOCAL_GC_WINDOW),
    [sequence, position],
  )

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
    const svg = svgRef.current
    if (!svg) return position
    const rect = svg.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const frac = rect.width > 0 ? x / rect.width : 0
    return Math.max(1, Math.min(seqLen - 1, Math.round(frac * seqLen)))
  }

  const handleProfilePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
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

  const balanceRatio =
    fragmentStats &&
    `${Math.round((fragmentStats.five.length / seqLen) * 100)} / ${Math.round(
      (fragmentStats.three.length / seqLen) * 100,
    )}`

  return (
    <div className="space-y-2">
      {/* Raw-measurement strip — facts, no composite score */}
      <div className="bg-muted/30 grid grid-cols-2 gap-x-3 gap-y-1 rounded-sm border px-2 py-1.5 text-[10px] md:grid-cols-4">
        <Measurement
          label="Balance"
          value={balanceRatio ?? '—'}
          unit="% 5′/3′"
        />
        <Measurement
          label="Nearest WGGW"
          value={
            nearestWggw
              ? nearestWggw.distance === 0
                ? 'on motif'
                : `${nearestWggw.distance.toLocaleString()} bp`
              : 'none'
          }
          unit={nearestWggw ? nearestWggw.motif : undefined}
          onClick={
            nearestWggw && nearestWggw.distance > 0
              ? () => onSnap(nearestWggw.position)
              : undefined
          }
        />
        <Measurement
          label={`Local GC (±${LOCAL_GC_WINDOW / 2}bp)`}
          value={`${localGc.toFixed(0)}`}
          unit="%"
        />
        <Measurement
          label="Frame"
          value={
            frameContext.frameOffset === 0
              ? 'codon boundary'
              : `+${frameContext.frameOffset} into codon`
          }
        />
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

      {/* GC profile + WGGW ticks, aligned to the slider axis above */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">
            Split context · <span className="italic">drag profile to set</span>
          </span>
          <div className="text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="bg-primary inline-block h-[2px] w-3" />
              GC %
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-[2px] bg-emerald-500" />
              WGGW ({wggwMotifs.length})
            </span>
          </div>
        </div>
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
            onPointerDown={handleProfilePointerDown}
            className="bg-muted/30 h-8 w-full cursor-ew-resize touch-none rounded-sm select-none"
            aria-label="GC content profile across sequence (drag to set split position)"
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
            {/* Current split position marker */}
            <line
              x1={positionPct}
              x2={positionPct}
              y1={0}
              y2={20}
              className="stroke-foreground"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* WGGW candidate ticks overlaid beneath */}
          <div className="relative mt-0.5 h-3 w-full">
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
                  onClick={() => onSnap(mid)}
                  title={`WGGW ${m.motif} at bp ${m.position}–${m.position + 3} · snap`}
                  className={cn(
                    'absolute top-0 h-full -translate-x-1/2 cursor-pointer rounded-sm transition-all',
                    'hover:h-[140%] hover:bg-emerald-400',
                    isCandidate
                      ? 'w-[2px] bg-amber-500'
                      : isNearest
                        ? 'w-[2px] bg-emerald-500'
                        : 'w-[1px] bg-emerald-500/60',
                  )}
                  style={{ left: `${x}%` }}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Frame-at-split readout */}
      <FrameAtSplit ctx={frameContext} position={position} />
    </div>
  )
}

function Measurement({
  label,
  value,
  unit,
  onClick,
}: {
  label: string
  value: string
  unit?: string
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="text-muted-foreground leading-tight">{label}</div>
      <div className="font-mono tabular-nums">
        <span className="text-foreground">{value}</span>
        {unit && <span className="text-muted-foreground ml-1">{unit}</span>}
      </div>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="hover:bg-muted/50 -m-1 rounded-sm p-1 text-left transition-colors"
        title="Snap to nearest"
      >
        {content}
      </button>
    )
  }
  return <div>{content}</div>
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
  }[]
}

function buildFrameContext(sequence: string, position: number): FrameContext {
  const upper = sequence.toUpperCase().replace(/U/g, 'T')
  // position is 1-based cut index: the cut falls *before* base at `position`.
  // Convert to 0-based cut index.
  const cut = Math.max(0, position - 1)
  const splitCodon = Math.floor(cut / 3)
  const frameOffset = cut % 3
  const totalCodons = Math.floor(upper.length / 3)

  const start = Math.max(0, splitCodon - CONTEXT_WINDOW)
  const end = Math.min(totalCodons, splitCodon + CONTEXT_WINDOW + 1)

  const codons: FrameContext['codons'] = []
  for (let i = start; i < end; i++) {
    const codon = upper.slice(i * 3, i * 3 + 3)
    const aa = codon.length === 3 ? translateCodon(codon) : null
    codons.push({ codon, aa, idx: i, isSplit: i === splitCodon })
  }

  return { splitCodon, frameOffset, codons }
}

function FrameAtSplit({
  ctx,
  position,
}: {
  ctx: FrameContext
  position: number
}) {
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
        className="bg-muted/40 overflow-x-auto rounded-sm border p-1.5 font-mono text-[10px] leading-none"
        role="img"
        aria-label="Codon context around splice junction"
      >
        <div className="flex items-center gap-[1px]">
          {ctx.codons.map((c) => (
            <div
              key={c.idx}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-sm px-[3px] py-1',
                c.isSplit && 'bg-primary/15 ring-primary/40 ring-1',
              )}
            >
              <span
                className={cn(
                  'tabular-nums',
                  c.isSplit
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground/70',
                )}
              >
                {c.aa ?? '·'}
              </span>
              <span className="flex">
                {[0, 1, 2].map((bi) => {
                  const base = c.codon[bi]
                  const isCutBase =
                    c.isSplit &&
                    ((ctx.frameOffset === 1 && bi === 0) ||
                      (ctx.frameOffset === 2 && bi === 1))
                  return (
                    <span
                      key={bi}
                      className={cn(
                        c.isSplit ? 'text-foreground' : 'text-muted-foreground',
                        isCutBase && 'border-primary border-r-2',
                      )}
                    >
                      {base ?? '·'}
                    </span>
                  )
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

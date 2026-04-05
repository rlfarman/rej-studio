'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { findWggwMotifs, slidingGcContent } from '@/lib/bio/sequence-utils'
import { translateCodon, AMINO_ACID_NAMES } from '@/lib/bio/genetic-code'

interface Props {
  sequence: string
  position: number
  onSnap: (position: number) => void
}

const MAX_WGGW_MARKERS = 200
const CONTEXT_WINDOW = 6 // codons of context on each side of the split

/**
 * Context strip that sits directly under the splice-junction slider:
 * - A GC micro-profile (40–60% target band) so users avoid splitting through
 *   high-GC / potentially structured regions
 * - WGGW candidate ticks aligned to the slider axis — clicking snaps the
 *   position to the nearest WGGW boundary
 * - Live frame-at-split readout showing the codon and amino acid being
 *   bisected, with ±2 codons of context
 */
export function SpliceSliderContext({ sequence, position, onSnap }: Props) {
  const seqLen = sequence.length

  const { gcPoints, wggwMotifs, nearestWggw } = useMemo(() => {
    if (seqLen < 12) {
      return { gcPoints: [], wggwMotifs: [], nearestWggw: null }
    }
    // Window scales with sequence length: bigger windows for long CDSs,
    // tighter windows for short ones. 30–120bp range feels sensible.
    const window = Math.min(120, Math.max(30, Math.round(seqLen / 40)))
    const step = Math.max(1, Math.round(window / 6))
    const gcPoints = slidingGcContent(sequence, window, step)

    const motifs = findWggwMotifs(sequence).slice(0, MAX_WGGW_MARKERS)

    // Find the closest WGGW motif to the current position, for the "snap to
    // nearest" button. Use the motif's midpoint as the snap target.
    let nearest: { position: number; motif: string; distance: number } | null =
      null
    for (const m of motifs) {
      const mid = m.position + 1 // WGGW is 4bp, split between bases 2 and 3
      const d = Math.abs(mid - position)
      if (!nearest || d < nearest.distance) {
        nearest = { position: mid, motif: m.motif, distance: d }
      }
    }

    return { gcPoints, wggwMotifs: motifs, nearestWggw: nearest }
  }, [sequence, seqLen, position])

  const frameContext = useMemo(() => {
    return buildFrameContext(sequence, position)
  }, [sequence, position])

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
  const nearestPct = nearestWggw ? (nearestWggw.position / seqLen) * 100 : null

  return (
    <div className="space-y-2">
      {/* GC profile + WGGW ticks, aligned to the slider axis above */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Split context</span>
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
          {/* SVG profile: target band (40-60%) shaded, GC polyline drawn on top */}
          <svg
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
            className="bg-muted/30 h-8 w-full rounded-sm"
            aria-label="GC content profile across sequence"
          >
            {/* 40-60% target band */}
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
              strokeWidth={1}
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
              return (
                <button
                  type="button"
                  key={`${mid}-${i}`}
                  onClick={() => onSnap(mid)}
                  title={`WGGW ${m.motif} at bp ${m.position}–${m.position + 3} · snap`}
                  className={cn(
                    'absolute top-0 h-full -translate-x-1/2 cursor-pointer rounded-sm transition-all',
                    'hover:h-[140%] hover:bg-emerald-400',
                    isNearest
                      ? 'w-[2px] bg-emerald-500'
                      : 'w-[1px] bg-emerald-500/60',
                  )}
                  style={{ left: `${x}%` }}
                />
              )
            })}
          </div>
        </div>
        {nearestWggw && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">
              Nearest WGGW:{' '}
              <span className="text-foreground font-mono">
                {nearestWggw.motif}
              </span>{' '}
              at bp {nearestWggw.position.toLocaleString()}
              {nearestWggw.distance > 0 && (
                <span className="text-muted-foreground">
                  {' '}
                  ({nearestWggw.distance.toLocaleString()} bp away)
                </span>
              )}
            </span>
            {nearestWggw.distance > 0 && (
              <button
                type="button"
                onClick={() => onSnap(nearestWggw.position)}
                className="text-primary hover:underline"
              >
                Snap here
              </button>
            )}
          </div>
        )}
      </div>

      {/* Frame-at-split readout */}
      <FrameAtSplit ctx={frameContext} position={position} />
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

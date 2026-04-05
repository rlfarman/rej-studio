'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  rankInducibleWggwByBalance,
  type RankedInducibleWggwCandidate,
} from '@/lib/bio/sequence-utils'
import { translateCodon, AMINO_ACID_NAMES } from '@/lib/bio/genetic-code'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Keyboard } from 'lucide-react'

interface Props {
  sequence: string
  position: number
  onSnap: (position: number) => void
}

const MIN_CONTEXT_WINDOW = 6 // minimum codons on each side of the split
const MAX_CONTEXT_WINDOW = 30 // cap to keep text readable
const PX_PER_CODON = 28 // approximate minimum width for a 3-base codon box

/**
 * Context strip that sits directly under the splice-junction slider. It
 * focuses on selecting a splice-junction candidate without overloading the
 * user with secondary heuristics. It keeps the global WGGW-capable ticks and
 * the local codon-level frame context.
 */
export function SpliceSliderContext({ sequence, position, onSnap }: Props) {
  const seqLen = sequence.length
  const trackRef = useRef<HTMLDivElement>(null)

  const { wggwMotifs, nearestWggw } = useMemo(() => {
    if (seqLen < 12) {
      return {
        wggwMotifs: [],
        nearestWggw: null,
      }
    }
    const motifs = rankInducibleWggwByBalance(sequence)

    // Nearest WGGW to the current cut, for the "snap to nearest" button.
    let nearest: (RankedInducibleWggwCandidate & { distance: number }) | null =
      null
    for (const m of motifs) {
      const d = Math.abs(m.position - position)
      if (!nearest || d < nearest.distance) {
        nearest = { ...m, distance: d }
      }
    }

    return { wggwMotifs: motifs, nearestWggw: nearest }
  }, [sequence, seqLen, position])

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
      // Total codons = 2*window + 1 ≤ fit → window ≤ (fit - 1) / 2
      const half = Math.max(
        MIN_CONTEXT_WINDOW,
        Math.min(MAX_CONTEXT_WINDOW, Math.floor((fit - 1) / 2)),
      )
      setContextWindow(half)
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

  const positionPct = (position / seqLen) * 100

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

  return (
    <div className="space-y-2">
      {/* WGGW-capable split selector. Drag anywhere, arrow keys to nudge,
          Home/End to jump to ends. */}
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
          className="focus-visible:ring-ring bg-muted/20 relative h-8 cursor-ew-resize touch-none rounded-md border select-none focus:outline-none focus-visible:ring-2"
        >
          <div className="absolute inset-0 overflow-hidden rounded-md">
            {wggwMotifs.map((m, i) => {
              const mid = m.position
              const x = (mid / seqLen) * 100
              const isNearest =
                nearestWggw !== null && nearestWggw.position === mid
              const sourceLabel = m.alreadyPresent
                ? 'present in sequence'
                : `inducible via synonymous recoding (${m.baseChanges} base${m.baseChanges === 1 ? '' : 's'} changed)`
              return (
                <button
                  type="button"
                  key={`${mid}-${i}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSnap(mid)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title={`WGGW-capable ${m.motif} at bp ${m.motifStart}–${m.motifStart + 3} · ${sourceLabel} · rewritten 6mer ${m.newHexamer} · snap`}
                  className="group absolute top-0 flex h-full w-3 -translate-x-1/2 cursor-pointer items-stretch justify-center"
                  style={{ left: `${x}%` }}
                >
                  <span
                    className={cn(
                      'rounded-sm transition-all',
                      'group-hover:w-[3px] group-hover:bg-emerald-400',
                      isNearest
                        ? 'w-[2px] bg-emerald-500'
                        : 'w-[1px] bg-emerald-500/60',
                    )}
                  />
                </button>
              )
            })}
          </div>
          <div
            className="border-foreground pointer-events-none absolute inset-y-0 w-0 border-l-2"
            style={{ left: `${positionPct}%` }}
            aria-hidden="true"
          />
        </div>
        {/* Single readout */}
        <div className="text-muted-foreground flex items-center justify-between gap-2 text-[10px]">
          <span className="font-mono tabular-nums">
            bp {position.toLocaleString()}
            {nearestWggw && (
              <>
                {' · nearest WGGW '}
                {nearestWggw.alreadyPresent ? '' : 'candidate '}
                {nearestWggw.distance === 0
                  ? 'on cut'
                  : `${nearestWggw.position > position ? '+' : '−'}${nearestWggw.distance} bp`}
              </>
            )}
          </span>
            <span className="flex items-center gap-1.5">
              <span>WGGW-capable: {wggwMotifs.length}</span>
              <KeyboardHelp />
            </span>
          </div>
      </div>

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
  wggwMotifs: RankedInducibleWggwCandidate[]
}) {
  // 1-based base positions belonging to any WGGW motif (each motif spans 4 bp).
  const wggwBases = useMemo(() => {
    const s = new Set<number>()
    for (const m of wggwMotifs) {
      if (!m.alreadyPresent) continue
      for (let k = 0; k < 4; k++) s.add(m.motifStart + k)
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
      const motifStart = m.motifStart
      const motifEnd = m.motifStart + 3
      if (motifEnd < codonStart || motifStart > codonEnd) continue
      const cut = m.position // midpoint cut (same as the tick)
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
                  'hover:bg-primary/10 hover:ring-primary/30 flex flex-1 flex-col items-center gap-0.5 rounded-sm px-[3px] py-1 transition-colors hover:ring-1',
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

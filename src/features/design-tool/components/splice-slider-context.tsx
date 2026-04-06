'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  rankInducibleWggwByBalance,
  type RankedInducibleWggwCandidate,
  type WggwRecodingOption,
} from '@/lib/bio/sequence-utils'
import { translateCodon } from '@/lib/bio/genetic-code'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  sequence: string
  position: number
  onSnap: (position: number) => void
}

const MIN_CONTEXT_WINDOW = 6 // minimum codons on each side of the split
const MAX_CONTEXT_WINDOW = 30 // cap to keep text readable
const PX_PER_CODON = 28 // approximate minimum width for a 3-base codon box

interface WggwSiteCandidate extends RankedInducibleWggwCandidate {
  rewriteOptions: WggwRecodingOption[]
}

/**
 * Context strip that sits directly under the splice-junction slider. It
 * focuses on selecting a splice-junction candidate without overloading the
 * user with secondary heuristics. It keeps the global WGGW-capable ticks and
 * the local codon-level frame context.
 */
export function SpliceSliderContext({ sequence, position, onSnap }: Props) {
  const seqLen = sequence.length
  const trackRef = useRef<HTMLDivElement>(null)

  const { wggwSites } = useMemo(() => {
    if (seqLen < 12) {
      return {
        wggwSites: [],
      }
    }
    const sites = groupWggwSites(rankInducibleWggwByBalance(sequence))
    return { wggwSites: sites }
  }, [sequence, seqLen])

  const selectedSite = useMemo(
    () => wggwSites.find((site) => site.position === position) ?? null,
    [position, wggwSites],
  )
  const selectedSiteIndex = selectedSite
    ? wggwSites.findIndex((site) => site.position === selectedSite.position)
    : -1
  const nearbySites = useMemo(() => {
    if (wggwSites.length === 0) return []
    const nearest = [...wggwSites]
      .sort(
        (a, b) =>
          Math.abs(a.position - position) - Math.abs(b.position - position),
      )
      .slice(0, 5)
      .sort((a, b) => a.position - b.position)
    return nearest
  }, [position, wggwSites])

  const [rewriteSelection, setRewriteSelection] = useState<{
    position: number | null
    index: number
  }>({ position: null, index: 0 })
  const selectedRewriteIndex =
    selectedSite?.position === rewriteSelection.position
      ? rewriteSelection.index
      : 0

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
  const fivePrimeLength = position
  const threePrimeLength = seqLen - position
  const fivePct = seqLen > 0 ? (fivePrimeLength / seqLen) * 100 : 50

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
          className="focus-visible:ring-ring bg-background/80 relative cursor-ew-resize touch-none rounded-xl border shadow-sm select-none focus:outline-none focus-visible:ring-2"
        >
          <div className="relative flex h-16 w-full overflow-hidden rounded-xl">
            <div
              className="bg-primary/15 flex min-w-0 items-center justify-center"
              style={{ width: `${fivePct}%` }}
            >
              <span className="text-primary pointer-events-none truncate px-4 text-sm font-semibold tracking-[0.01em]">
                5′ · {fivePrimeLength.toLocaleString()} bp
              </span>
            </div>
            <div className="bg-muted/50 flex min-w-0 flex-1 items-center justify-center">
              <span className="text-muted-foreground pointer-events-none truncate px-4 text-sm font-semibold tracking-[0.01em]">
                3′ · {threePrimeLength.toLocaleString()} bp
              </span>
            </div>
          </div>
          <div className="bg-background/70 absolute inset-x-0 bottom-0 h-5 overflow-hidden rounded-b-xl border-t">
            {wggwSites.map((site, i) => {
              const mid = site.position
              const x = (mid / seqLen) * 100
              const isSelected = selectedSite?.position === mid
              const sourceLabel = site.alreadyPresent
                ? 'present in sequence'
                : 'inducible via synonymous recoding'
              return (
                <button
                  type="button"
                  key={`${mid}-${i}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSnap(mid)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title={`WGGW-capable ${site.motif} at bp ${site.motifStart}–${site.motifStart + 3} · ${sourceLabel} · rewritten 6mer ${site.newHexamer} · snap`}
                  className="group absolute top-0 flex h-full w-7 -translate-x-1/2 cursor-pointer items-center justify-center"
                  style={{ left: `${x}%` }}
                >
                  <span
                    className={cn(
                      'rounded-full transition-all',
                      'group-hover:h-4',
                      isSelected
                        ? 'bg-primary h-4 w-1.5'
                        : site.alreadyPresent
                          ? 'h-3 w-1 bg-emerald-500/75'
                          : 'h-3 w-1 bg-amber-500/90',
                    )}
                  />
                </button>
              )
            })}
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 w-0"
            style={{ left: `${positionPct}%` }}
            aria-hidden="true"
          >
            <div className="border-foreground/85 absolute inset-y-0 border-l-2" />
            <div className="bg-foreground/90 absolute top-2 left-1/2 size-3 -translate-x-1/2 rotate-45 rounded-[2px]" />
          </div>
          <div
            className="bg-background text-foreground pointer-events-none absolute -top-3 -translate-x-1/2 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm"
            style={{ left: `${positionPct}%` }}
          >
            {position.toLocaleString()} bp
          </div>
        </div>
        {/* Frame-at-split readout */}
        <FrameAtSplit
          ctx={frameContext}
          position={position}
          onSnap={onSnap}
          stripRef={frameStripRef}
          wggwSites={wggwSites}
          selectedSite={selectedSite}
          selectedRewriteIndex={selectedRewriteIndex}
          nearbySites={nearbySites}
          selectedSiteIndex={selectedSiteIndex}
          onSelectRewrite={(index) =>
            setRewriteSelection({
              position: selectedSite?.position ?? null,
              index,
            })
          }
        />
      </div>
    </div>
  )
}

function dedupeRewriteOptions(options: WggwRecodingOption[]) {
  const seen = new Set<string>()
  return options.filter((option) => {
    const key = `${option.motif}|${option.newHexamer}|${option.motifOffset}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function groupWggwSites(
  candidates: RankedInducibleWggwCandidate[],
): WggwSiteCandidate[] {
  const byPosition = new Map<number, RankedInducibleWggwCandidate[]>()
  for (const candidate of candidates) {
    const group = byPosition.get(candidate.position)
    if (group) group.push(candidate)
    else byPosition.set(candidate.position, [candidate])
  }

  return [...byPosition.values()]
    .map((group) => {
      const representative = [...group].sort((a, b) => {
        if (a.alreadyPresent !== b.alreadyPresent) {
          return a.alreadyPresent ? -1 : 1
        }
        if (a.baseChanges !== b.baseChanges)
          return a.baseChanges - b.baseChanges
        return a.newHexamer.localeCompare(b.newHexamer)
      })[0]
      const rewriteOptions = dedupeRewriteOptions(
        group.flatMap((candidate) => candidate.rewriteOptions),
      ).sort((a, b) => {
        if (a.baseChanges !== b.baseChanges)
          return a.baseChanges - b.baseChanges
        return a.newHexamer.localeCompare(b.newHexamer)
      })
      const primary = rewriteOptions[0]
      return {
        ...representative,
        newHexamer: primary?.newHexamer ?? representative.newHexamer,
        newCodons: primary?.newCodons ?? representative.newCodons,
        baseChanges: primary?.baseChanges ?? representative.baseChanges,
        alreadyPresent:
          (primary?.baseChanges ?? representative.baseChanges) === 0,
        rewriteOptions,
      }
    })
    .sort((a, b) => a.position - b.position)
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
  wggwSites,
  selectedSite,
  selectedRewriteIndex,
  nearbySites,
  selectedSiteIndex,
  onSelectRewrite,
}: {
  ctx: FrameContext
  position: number
  onSnap: (position: number) => void
  stripRef: React.RefObject<HTMLDivElement | null>
  wggwSites: WggwSiteCandidate[]
  selectedSite: WggwSiteCandidate | null
  selectedRewriteIndex: number
  nearbySites: WggwSiteCandidate[]
  selectedSiteIndex: number
  onSelectRewrite: (index: number) => void
}) {
  const visibleBaseStart = ctx.codons[0]?.idx * 3 + 1
  const visibleBaseEnd = (ctx.codons.at(-1)?.idx ?? 0) * 3 + 3
  const localSites = useMemo(
    () =>
      wggwSites.filter(
        (site) =>
          site.position >= visibleBaseStart && site.position <= visibleBaseEnd,
      ),
    [visibleBaseEnd, visibleBaseStart, wggwSites],
  )

  const currentRewrite =
    selectedSite?.rewriteOptions[
      Math.min(selectedRewriteIndex, selectedSite.rewriteOptions.length - 1)
    ] ?? null

  const selectedBases = useMemo(() => {
    const s = new Set<number>()
    if (!selectedSite) return s
    for (let k = 0; k < 4; k++) s.add(selectedSite.motifStart + k)
    return s
  }, [selectedSite])

  const selectedChangedBases = useMemo(() => {
    const s = new Set<number>()
    if (!selectedSite || !currentRewrite) return s
    for (let i = 0; i < selectedSite.originalHexamer.length; i++) {
      if (selectedSite.originalHexamer[i] !== currentRewrite.newHexamer[i]) {
        s.add(selectedSite.hexamerStart + i)
      }
    }
    return s
  }, [currentRewrite, selectedSite])

  const selectedCodonIndices = useMemo(() => {
    const s = new Set<number>()
    if (!selectedSite) return s
    const firstCodonIdx = Math.floor((selectedSite.hexamerStart - 1) / 3)
    s.add(firstCodonIdx)
    s.add(firstCodonIdx + 1)
    return s
  }, [selectedSite])

  return (
    <div className="space-y-3">
      <div
        ref={stripRef}
        className="bg-muted/40 rounded-lg border p-2 font-mono text-[10px] leading-none shadow-sm"
        role="img"
        aria-label="Codon context around splice junction"
      >
        <div className="mb-1 flex w-full items-center gap-[1px]">
          {ctx.codons.map((c) => {
            const roleStyles = roleStylesFor(c.role)
            return (
              <div
                key={c.idx}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-sm px-[3px] py-1',
                  c.role === 'split' ? '' : roleStyles.container,
                  selectedCodonIndices.has(c.idx) &&
                    (selectedSite?.alreadyPresent
                      ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30'
                      : 'bg-amber-500/10 ring-1 ring-amber-500/30'),
                )}
              >
                <span
                  className={cn(
                    'tabular-nums',
                    roleStyles.aa,
                    selectedCodonIndices.has(c.idx) && 'text-foreground',
                  )}
                >
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
                    const inSelected = selectedBases.has(basePos)
                    const isChanged = selectedChangedBases.has(basePos)
                    return (
                      <span
                        key={bi}
                        className={cn(
                          roleStyles.base,
                          inSelected &&
                            (selectedSite?.alreadyPresent
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'),
                          isChanged &&
                            'underline decoration-2 underline-offset-2',
                          isCutBase && 'border-primary border-r-2',
                        )}
                      >
                        {base ?? '·'}
                      </span>
                    )
                  })}
                </span>
              </div>
            )
          })}
        </div>
        <div className="relative h-8">
          {localSites.map((site) => {
            const left =
              ((site.position - visibleBaseStart) /
                Math.max(1, visibleBaseEnd - visibleBaseStart)) *
              100
            const isSelected = selectedSite?.position === site.position
            return (
              <button
                type="button"
                key={site.position}
                onClick={() => onSnap(site.position)}
                title={`${site.motif} at bp ${site.position.toLocaleString()} · ${site.alreadyPresent ? 'present' : 'inducible'}${site.rewriteOptions.length > 1 ? ` · ${site.rewriteOptions.length} rewrite options` : ''}`}
                className="absolute top-0 flex min-h-8 -translate-x-1/2 flex-col items-center gap-1 px-1"
                style={{ left: `${left}%` }}
              >
                <span
                  className={cn(
                    'block h-3.5 w-1 rounded-full',
                    isSelected
                      ? 'bg-primary'
                      : site.alreadyPresent
                        ? 'bg-emerald-500'
                        : 'bg-amber-500',
                  )}
                />
                <span
                  className={cn(
                    'rounded-md border px-1.5 py-0.5 text-[9px] leading-none',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground border-transparent',
                  )}
                >
                  {site.position}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {nearbySites.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <button
            type="button"
            onClick={() => {
              const previous =
                selectedSiteIndex > 0
                  ? wggwSites[selectedSiteIndex - 1]
                  : nearbySites[0]
              if (previous) onSnap(previous.position)
            }}
            className="text-muted-foreground hover:text-foreground inline-flex h-9 items-center justify-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Previous site
          </button>
          <div className="flex flex-wrap gap-2">
            {nearbySites.map((site) => {
              const isSelected = selectedSite?.position === site.position
              return (
                <button
                  type="button"
                  key={site.position}
                  onClick={() => onSnap(site.position)}
                  className={cn(
                    'min-h-10 rounded-md border px-3 py-2 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 ring-primary/20 ring-1'
                      : 'hover:border-primary/30 hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <span className="font-mono">{site.motif}</span>
                    <span className="text-muted-foreground font-mono">
                      {site.position}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        site.alreadyPresent
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {site.alreadyPresent ? 'present' : `${site.baseChanges} bp`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const next =
                selectedSiteIndex >= 0 &&
                selectedSiteIndex < wggwSites.length - 1
                  ? wggwSites[selectedSiteIndex + 1]
                  : nearbySites.at(-1)
              if (next) onSnap(next.position)
            }}
            className="text-muted-foreground hover:text-foreground inline-flex h-9 items-center justify-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors"
          >
            Next site
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
      <div className="mx-auto w-full max-w-3xl">
        <div className="bg-muted/30 min-h-[228px] space-y-3 rounded-lg border p-3 text-[11px] shadow-sm">
          {selectedSite && currentRewrite ? (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">
                      Selected site
                    </span>
                    <span
                      className={cn(
                        'rounded-md px-2 py-1 font-mono text-xs font-semibold',
                        selectedSite.alreadyPresent
                          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/14 text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {selectedSite.motif}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                      bp {selectedSite.position.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SummaryBadge
                      label="Source"
                      value={
                        selectedSite.alreadyPresent
                          ? 'Already present'
                          : 'Inducible'
                      }
                    />
                    <SummaryBadge
                      label="Base changes"
                      value={currentRewrite.baseChanges.toString()}
                    />
                    <SummaryBadge
                      label="Fragments"
                      value={`${selectedSite.fivePrimeLength.toLocaleString()} / ${selectedSite.threePrimeLength.toLocaleString()} bp`}
                    />
                  </div>
                </div>
                {selectedSite.rewriteOptions.length > 1 && (
                  <div className="flex max-w-full flex-wrap items-center gap-1.5 md:justify-end">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
                      Synonymous rewrites
                    </span>
                    {selectedSite.rewriteOptions.map((option, index) => (
                      <button
                        type="button"
                        key={`${option.newHexamer}-${index}`}
                        onClick={() => onSelectRewrite(index)}
                        className={cn(
                          'rounded-md border px-2 py-1 font-mono text-[10px] font-semibold',
                          index === selectedRewriteIndex
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        {option.newHexamer}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <RewritePreview
                peptide={translatePair(selectedSite.originalCodons)}
                beforeCodons={selectedSite.originalCodons}
                afterCodons={currentRewrite.newCodons}
                beforeHexamer={selectedSite.originalHexamer}
                afterHexamer={currentRewrite.newHexamer}
                changedFrom={selectedSite.originalHexamer}
                motifStart={currentRewrite.motifOffset}
                cutOffset={selectedSite.position - selectedSite.hexamerStart}
                alreadyPresent={selectedSite.alreadyPresent}
              />
            </>
          ) : (
            <div className="flex min-h-[192px] flex-col justify-center gap-3">
              <div className="space-y-2">
                <div className="text-foreground text-sm font-semibold">
                  Choose a WGGW site
                </div>
                <div className="text-muted-foreground text-[11px] leading-relaxed">
                  Move the breakpoint bar to the right region, then select one
                  of the nearby WGGW candidates to inspect the synonymous
                  rewrite.
                </div>
              </div>
              <div className="bg-background/80 grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                <div className="space-y-2">
                  <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
                    Junction consequence
                  </div>
                  <div className="grid gap-1.5 text-xs">
                    <PlaceholderRow label="Peptide" />
                    <PlaceholderRow label="Before" />
                    <PlaceholderRow label="After" />
                  </div>
                </div>
                <div className="bg-muted/30 grid gap-2 rounded-md border p-3 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Motif window</span>
                    <PlaceholderPill className="w-20" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      Selected rewrite
                    </span>
                    <PlaceholderPill className="w-24" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Cut offset</span>
                    <PlaceholderPill className="w-10" />
                  </div>
                  <div className="text-muted-foreground text-[10px] leading-relaxed">
                    Choose a candidate above to preview the synonymous change
                    pattern and highlighted WGGW motif across the junction.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function translatePair(codons: [string, string]) {
  return codons.map((codon) => translateCodon(codon) ?? '?').join('')
}

function RewritePreview({
  peptide,
  beforeCodons,
  afterCodons,
  beforeHexamer,
  afterHexamer,
  motifStart,
  cutOffset,
  changedFrom,
  alreadyPresent,
}: {
  peptide: string
  beforeCodons: [string, string]
  afterCodons: [string, string]
  beforeHexamer: string
  afterHexamer: string
  motifStart: number
  cutOffset: number
  changedFrom: string
  alreadyPresent: boolean
}) {
  return (
    <div className="bg-background/80 grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <div className="space-y-2">
        <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
          Junction consequence
        </div>
        <div className="grid gap-1.5 font-mono text-xs">
          <DiffRow
            label="Peptide"
            content={
              <span>
                {peptide[0] ?? '·'} {peptide[1] ?? '·'}
              </span>
            }
          />
          <DiffRow
            label="Before"
            content={
              <span>
                {beforeCodons[0]} {beforeCodons[1]}
              </span>
            }
          />
          <DiffRow
            label="After"
            content={
              <div className="flex">
                {[...afterHexamer].map((base, index) => {
                  const inMotif = index >= motifStart && index < motifStart + 4
                  const isChanged = changedFrom[index] !== base
                  const isCut = index === cutOffset
                  return (
                    <span
                      key={index}
                      className={cn(
                        'px-[1px]',
                        index === 3 && 'ml-1',
                        inMotif &&
                          (alreadyPresent
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'),
                        isChanged &&
                          'underline decoration-2 underline-offset-2',
                        isCut && 'border-primary border-r-2',
                      )}
                    >
                      {base}
                    </span>
                  )
                })}
              </div>
            }
          />
        </div>
      </div>
      <div className="bg-muted/30 grid gap-2 rounded-md border p-3 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Motif window</span>
          <span className="font-mono font-semibold">
            {beforeHexamer.slice(0, 3)} {beforeHexamer.slice(3)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Selected rewrite</span>
          <span className="font-mono font-semibold">
            {afterHexamer.slice(0, 3)} {afterHexamer.slice(3)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Cut offset</span>
          <span className="font-mono font-semibold">+{cutOffset}</span>
        </div>
        <div className="text-muted-foreground text-[10px] leading-relaxed">
          Underlined bases change during synonymous recoding. Highlighted bases
          mark the selected WGGW motif that spans the junction.
        </div>
      </div>
    </div>
  )
}

function SummaryBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background/80 rounded-md border px-2 py-1">
      <div className="text-muted-foreground text-[10px] tracking-[0.08em] uppercase">
        {label}
      </div>
      <div className="text-foreground text-xs font-medium">{value}</div>
    </div>
  )
}

function DiffRow({ label, content }: { label: string; content: ReactNode }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2">
      <span className="text-muted-foreground text-[10px] tracking-[0.08em] uppercase">
        {label}
      </span>
      <div>{content}</div>
    </div>
  )
}

function PlaceholderRow({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2">
      <span className="text-muted-foreground text-[10px] tracking-[0.08em] uppercase">
        {label}
      </span>
      <div className="flex items-center">
        <div className="bg-muted h-3 w-24 rounded-full" />
      </div>
    </div>
  )
}

function PlaceholderPill({ className }: { className?: string }) {
  return <div className={cn('bg-muted h-3 rounded-full', className)} />
}

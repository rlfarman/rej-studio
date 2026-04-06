'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  rankInducibleWggwByBalance,
  type RankedInducibleWggwCandidate,
  type WggwRecodingOption,
} from '@/lib/bio/sequence-utils'
import { translateCodon } from '@/lib/bio/genetic-code'
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

  const [selectedRewriteIndex, setSelectedRewriteIndex] = useState(0)
  useEffect(() => {
    setSelectedRewriteIndex(0)
  }, [selectedSite?.position])

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
          className="focus-visible:ring-ring relative cursor-ew-resize touch-none rounded-lg border select-none focus:outline-none focus-visible:ring-2"
        >
          <div className="relative flex h-12 w-full overflow-hidden rounded-lg">
            <div
              className="bg-primary/15 flex min-w-0 items-center justify-center"
              style={{ width: `${fivePct}%` }}
            >
              <span className="text-primary pointer-events-none truncate px-3 text-sm font-medium">
                5′ · {fivePrimeLength.toLocaleString()} bp
              </span>
            </div>
            <div className="bg-muted/50 flex min-w-0 flex-1 items-center justify-center">
              <span className="text-muted-foreground pointer-events-none truncate px-3 text-sm font-medium">
                3′ · {threePrimeLength.toLocaleString()} bp
              </span>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-3 overflow-hidden rounded-b-lg">
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
                  className="group absolute top-0 flex h-full w-4 -translate-x-1/2 cursor-pointer items-stretch justify-center"
                  style={{ left: `${x}%` }}
                >
                  <span
                    className={cn(
                      'rounded-sm transition-all',
                      'group-hover:w-[4px]',
                      isSelected
                        ? 'w-[4px] bg-primary'
                        : site.alreadyPresent
                          ? 'w-[2px] bg-emerald-500/70'
                          : 'w-[2px] bg-amber-500/90',
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
          <div
            className="bg-background text-foreground pointer-events-none absolute -top-3 -translate-x-1/2 rounded border px-2 py-1 font-mono text-xs shadow-sm"
            style={{ left: `${positionPct}%` }}
          >
            {position.toLocaleString()} bp
          </div>
        </div>
        {/* Single readout */}
        <div className="text-muted-foreground flex items-center justify-between gap-2 text-[10px]">
          <span className="font-mono tabular-nums">bp {position.toLocaleString()}</span>
          <span className="flex items-center gap-1.5">
            <span>WGGW-capable: {wggwSites.length}</span>
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
        wggwSites={wggwSites}
        selectedSite={selectedSite}
        selectedRewriteIndex={selectedRewriteIndex}
        onSelectRewrite={setSelectedRewriteIndex}
      />
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
        if (a.baseChanges !== b.baseChanges) return a.baseChanges - b.baseChanges
        return a.newHexamer.localeCompare(b.newHexamer)
      })[0]
      const rewriteOptions = dedupeRewriteOptions(
        group.flatMap((candidate) => candidate.rewriteOptions),
      ).sort((a, b) => {
        if (a.baseChanges !== b.baseChanges) return a.baseChanges - b.baseChanges
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
  onSelectRewrite,
}: {
  ctx: FrameContext
  position: number
  onSnap: (position: number) => void
  stripRef: React.RefObject<HTMLDivElement | null>
  wggwSites: WggwSiteCandidate[]
  selectedSite: WggwSiteCandidate | null
  selectedRewriteIndex: number
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
    <div className="space-y-1">
      <div
        ref={stripRef}
        className="bg-muted/40 rounded-sm border p-1.5 font-mono text-[10px] leading-none"
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
                      ? 'bg-emerald-500/10 ring-emerald-500/30 ring-1'
                      : 'bg-amber-500/10 ring-amber-500/30 ring-1'),
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
                          isChanged && 'underline decoration-2 underline-offset-2',
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
        <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-medium tracking-[0.08em] text-muted-foreground/80 uppercase">
          <span>Local WGGW Sites</span>
          <span>
            {selectedSite
              ? 'Click another marker to compare'
              : 'Click a marker to choose a site'}
          </span>
        </div>
        <div className="bg-background/75 relative h-8 rounded-sm border px-2">
          <div className="bg-border/70 absolute inset-x-2 top-3 h-px" />
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
                className="group absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${left}%` }}
              >
                <span
                  className={cn(
                    'mt-[7px] block h-3 rounded-full transition-all',
                    isSelected
                      ? 'bg-primary w-[4px]'
                      : site.alreadyPresent
                        ? 'bg-emerald-500/90 w-[3px] group-hover:w-[4px]'
                        : 'bg-amber-500/90 w-[3px] group-hover:w-[4px]',
                  )}
                />
                <span
                  className={cn(
                    'absolute top-0 rounded-full border px-1.5 py-0.5 text-[9px] leading-none transition-opacity',
                    isSelected
                      ? 'border-primary/50 bg-primary/10 text-primary opacity-100'
                      : 'border-transparent bg-background/90 text-muted-foreground opacity-0 group-hover:opacity-100',
                  )}
                >
                  {site.position}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="mx-auto mt-1 w-full max-w-xl">
        <div className="bg-muted/30 min-h-28 space-y-2 rounded-sm border p-2.5 text-[10px]">
          {selectedSite && currentRewrite ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-foreground text-[11px] font-medium">
                    Rewrite Preview
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-muted-foreground">
                      bp {selectedSite.position.toLocaleString()}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 font-mono',
                        selectedSite.alreadyPresent
                          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {selectedSite.alreadyPresent ? 'present' : 'inducible'}{' '}
                      {selectedSite.motif}
                    </span>
                  </div>
                </div>
                {selectedSite.rewriteOptions.length > 1 && (
                  <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
                    <span className="text-muted-foreground">
                      Synonymous rewrites
                    </span>
                    {selectedSite.rewriteOptions.map((option, index) => (
                      <button
                        type="button"
                        key={`${option.newHexamer}-${index}`}
                        onClick={() => onSelectRewrite(index)}
                        className={cn(
                          'rounded border px-1.5 py-0.5 font-mono',
                          index === selectedRewriteIndex
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:border-primary/40 hover:text-foreground',
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
                beforeHexamer={selectedSite.originalHexamer}
                afterHexamer={currentRewrite.newHexamer}
                changedFrom={selectedSite.originalHexamer}
                motifStart={currentRewrite.motifOffset}
                cutOffset={selectedSite.position - selectedSite.hexamerStart}
                alreadyPresent={selectedSite.alreadyPresent}
              />
            </>
          ) : (
            <div className="text-muted-foreground flex min-h-24 flex-col items-center justify-center gap-1 text-center">
              <div className="font-medium">No splice junction selected</div>
              <div>
                Drag the slider to inspect a region, then click a local WGGW
                marker to preview a specific rewrite.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function translatePair(codons: [string, string]) {
  return codons
    .map((codon) => translateCodon(codon) ?? '?')
    .join('')
}

function RewritePreview({
  peptide,
  beforeHexamer,
  afterHexamer,
  motifStart,
  cutOffset,
  changedFrom,
  alreadyPresent,
}: {
  peptide: string
  beforeHexamer: string
  afterHexamer: string
  motifStart: number
  cutOffset: number
  changedFrom: string
  alreadyPresent: boolean
}) {
  return (
    <div className="space-y-2 rounded-sm border bg-background/70 p-2 font-mono">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Peptide preserved</span>
        <span className="tracking-[0.14em]">
          {peptide[0] ?? '·'} {peptide[1] ?? '·'}
        </span>
      </div>
      <div className="grid gap-1.5 text-[11px]">
        <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
          <span className="text-muted-foreground text-[10px]">Before</span>
          <SequenceRow
            sequence={beforeHexamer}
            changedFrom={changedFrom}
            motifStart={motifStart}
            cutOffset={cutOffset}
            alreadyPresent={alreadyPresent}
          />
        </div>
        <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
          <span className="text-muted-foreground text-[10px]">After</span>
          <SequenceRow
            sequence={afterHexamer}
            changedFrom={changedFrom}
            motifStart={motifStart}
            cutOffset={cutOffset}
            alreadyPresent={alreadyPresent}
          />
        </div>
      </div>
    </div>
  )
}

function SequenceRow({
  sequence,
  changedFrom,
  motifStart,
  cutOffset,
  alreadyPresent,
}: {
  sequence: string
  changedFrom: string
  motifStart: number
  cutOffset: number
  alreadyPresent: boolean
}) {
  return (
    <div className="flex min-w-0 items-center">
      {[...sequence].map((base, index) => {
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
              isChanged && 'underline decoration-2 underline-offset-2',
              isCut && 'border-primary border-r-2',
            )}
          >
            {base}
          </span>
        )
      })}
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

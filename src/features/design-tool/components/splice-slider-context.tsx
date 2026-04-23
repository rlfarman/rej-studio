'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  rankInducibleWggwByBalance,
  type RankedInducibleWggwCandidate,
  type WggwRecodingOption,
} from '@/lib/bio/sequence-utils'
import { translateCodon } from '@/lib/bio/genetic-code'
import { ChevronLeft, ChevronRight, AlignCenter } from 'lucide-react'
import type { SelectedWggwSite } from '../types/form-schema'

interface Props {
  sequence: string
  position: number
  onSnap: (position: number) => void
  onSelectionChange: (site: SelectedWggwSite | null) => void
}

const MIN_CONTEXT_WINDOW = 18
const MAX_CONTEXT_WINDOW = 72
const PX_PER_BASE = 18
const RULER_LABEL_CODON_INTERVAL = 5

interface WggwSiteCandidate extends RankedInducibleWggwCandidate {
  rewriteOptions: WggwRecodingOption[]
}

export function SpliceSliderContext({
  sequence,
  position,
  onSnap,
  onSelectionChange,
}: Props) {
  const seqLen = sequence.length
  const trackRef = useRef<HTMLDivElement>(null)
  const frameStripRef = useRef<HTMLDivElement>(null)

  const wggwSites = useMemo<WggwSiteCandidate[]>(() => {
    if (seqLen < 12) return []
    return groupWggwSites(rankInducibleWggwByBalance(sequence))
  }, [sequence, seqLen])

  const midpoint = Math.max(1, Math.min(seqLen - 1, Math.floor(seqLen / 2)))

  const siteAtPosition = useMemo(
    () => wggwSites.find((site) => site.position === position) ?? null,
    [position, wggwSites],
  )
  const [activeSitePosition, setActiveSitePosition] = useState<number | null>(
    null,
  )
  const fallbackSiteIndex = nearestSiteIndex(wggwSites, position)
  const selectedSite = useMemo(
    () =>
      wggwSites.find((site) => site.position === activeSitePosition) ??
      siteAtPosition ??
      (fallbackSiteIndex === -1 ? null : wggwSites[fallbackSiteIndex]),
    [activeSitePosition, fallbackSiteIndex, siteAtPosition, wggwSites],
  )
  const selectedSiteIndex = selectedSite
    ? wggwSites.findIndex((site) => site.position === selectedSite.position)
    : -1

  const [rewriteSelection, setRewriteSelection] = useState<{
    position: number | null
    index: number
  }>({ position: null, index: 0 })
  const selectedRewriteIndex =
    selectedSite?.position === rewriteSelection.position
      ? rewriteSelection.index
      : 0
  const currentRewrite =
    selectedSite?.rewriteOptions[
      Math.min(selectedRewriteIndex, selectedSite.rewriteOptions.length - 1)
    ] ?? null

  const [contextWindow, setContextWindow] = useState(MIN_CONTEXT_WINDOW)

  useEffect(() => {
    const el = frameStripRef.current
    if (!el) return
    const update = () => {
      const width = el.clientWidth
      if (width <= 0) return
      const fit = Math.floor(width / PX_PER_BASE)
      const half = Math.max(
        MIN_CONTEXT_WINDOW,
        Math.min(MAX_CONTEXT_WINDOW, Math.floor(fit / 2)),
      )
      setContextWindow(half)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const frameContext = useMemo(
    () => buildSequenceContext(sequence, position, contextWindow),
    [sequence, position, contextWindow],
  )

  useEffect(() => {
    if (!selectedSite || !currentRewrite) {
      onSelectionChange(null)
      return
    }
    onSelectionChange({
      position: selectedSite.position,
      motifStart: selectedSite.motifStart,
      motif: selectedSite.motif,
      hexamerStart: selectedSite.hexamerStart,
      originalCodons: selectedSite.originalCodons,
      newCodons: currentRewrite.newCodons,
      newHexamer: currentRewrite.newHexamer,
    })
  }, [currentRewrite, onSelectionChange, selectedSite])

  if (seqLen < 12) return null

  const positionPct = (position / seqLen) * 100
  const fivePrimeLength = position
  const threePrimeLength = seqLen - position
  const fivePct = seqLen > 0 ? (fivePrimeLength / seqLen) * 100 : 50

  const positionFromPointer = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return position
    const rect = track.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const frac = rect.width > 0 ? x / rect.width : 0
    return Math.max(1, Math.min(seqLen - 1, Math.round(frac * seqLen)))
  }

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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

  const jumpToSibling = (dir: -1 | 1) => {
    if (wggwSites.length === 0) return
    if (selectedSiteIndex === -1) {
      const next = nearestSiteIndex(wggwSites, position)
      if (next !== -1) handleSelectSite(wggwSites[next])
      return
    }
    const target = selectedSiteIndex + dir
    if (target < 0 || target >= wggwSites.length) return
    handleSelectSite(wggwSites[target])
  }

  const handleTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === '[') {
      e.preventDefault()
      jumpToSibling(-1)
      return
    }
    if (e.key === ']') {
      e.preventDefault()
      jumpToSibling(1)
      return
    }
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault()
      onSnap(midpoint)
      return
    }
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

  const handleSelectSite = (site: WggwSiteCandidate) => {
    setActiveSitePosition(site.position)
    onSnap(site.position)
  }

  return (
    <div className="space-y-3">
      <Toolbar
        total={wggwSites.length}
        onPrev={() => jumpToSibling(-1)}
        onNext={() => jumpToSibling(1)}
        onMidpoint={() => onSnap(midpoint)}
        canPrev={
          selectedSiteIndex > 0 ||
          (selectedSiteIndex === -1 && wggwSites.length > 0)
        }
        canNext={
          (selectedSiteIndex >= 0 &&
            selectedSiteIndex < wggwSites.length - 1) ||
          (selectedSiteIndex === -1 && wggwSites.length > 0)
        }
      />

      <div className="space-y-3">
        <div className="min-w-0 space-y-2">
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
            className="focus-visible:ring-ring bg-background/80 relative h-16 cursor-ew-resize touch-none rounded-xl border shadow-sm select-none focus:outline-none focus-visible:ring-2"
          >
            <div className="absolute inset-x-0 top-0 flex h-11 overflow-hidden rounded-t-xl">
              <div
                className="bg-primary/15 flex min-w-0 items-center justify-center"
                style={{ width: `${fivePct}%` }}
              >
                <span className="text-primary pointer-events-none truncate px-4 text-sm font-semibold tracking-[0.01em] tabular-nums">
                  5′ · {fivePrimeLength.toLocaleString()} bp
                </span>
              </div>
              <div className="bg-muted/50 flex min-w-0 flex-1 items-center justify-center">
                <span className="text-muted-foreground pointer-events-none truncate px-4 text-sm font-semibold tracking-[0.01em] tabular-nums">
                  3′ · {threePrimeLength.toLocaleString()} bp
                </span>
              </div>
            </div>
            <div className="bg-background/70 absolute inset-x-0 bottom-0 h-5 overflow-hidden rounded-b-xl border-t">
              {wggwSites.map((site, i) => {
                const x = (site.position / seqLen) * 100
                const isSelected = selectedSite?.position === site.position
                return (
                  <button
                    type="button"
                    key={`${site.position}-${i}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectSite(site)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title={`WGGW ${site.motif} · bp ${site.position.toLocaleString()} · ${site.baseChanges} bp change${site.baseChanges === 1 ? '' : 's'}`}
                    className="group absolute top-0 flex h-full w-7 -translate-x-1/2 cursor-pointer items-center justify-center"
                    style={{ left: `${x}%` }}
                  >
                    <span
                      className={cn(
                        'rounded-full transition-all group-hover:h-4',
                        isSelected
                          ? 'bg-primary h-4 w-1.5'
                          : 'bg-marker h-3 w-1',
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
              <div className="text-foreground/55 absolute top-5 left-1/2 flex -translate-x-1/2 items-center gap-3">
                <ChevronLeft className="size-3" strokeWidth={2.5} />
                <ChevronRight className="size-3" strokeWidth={2.5} />
              </div>
            </div>
            <div
              className="bg-background text-foreground pointer-events-none absolute -top-3 -translate-x-1/2 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold tabular-nums shadow-sm"
              style={{ left: `${positionPct}%` }}
            >
              {position.toLocaleString()} bp
            </div>
          </div>

          <LocalSequenceView
            ctx={frameContext}
            sites={wggwSites}
            selectedSite={selectedSite}
            currentRewrite={currentRewrite}
            stripRef={frameStripRef}
            onSelectSite={handleSelectSite}
          />
        </div>

        <Inspector
          selectedSite={selectedSite}
          currentRewrite={currentRewrite}
          selectedRewriteIndex={selectedRewriteIndex}
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

function Toolbar({
  total,
  onPrev,
  onNext,
  onMidpoint,
  canPrev,
  canNext,
}: {
  total: number
  onPrev: () => void
  onNext: () => void
  onMidpoint: () => void
  canPrev: boolean
  canNext: boolean
}) {
  return (
    <div className="bg-background/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <LegendDot tone="marker" />
          <span className="text-foreground font-semibold tabular-nums">
            {total.toLocaleString()}
          </span>{' '}
          WGGW candidate{total === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <ToolbarButton
          onClick={onPrev}
          disabled={!canPrev}
          title="Previous WGGW site ([)"
        >
          <ChevronLeft className="size-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={onMidpoint}
          title="Snap to midpoint (m)"
          variant="accent"
        >
          <AlignCenter className="size-3.5" />
          <span className="hidden sm:inline">Midpoint</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={onNext}
          disabled={!canNext}
          title="Next WGGW site (])"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-3.5" />
        </ToolbarButton>
      </div>
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  title,
  variant = 'default',
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
  variant?: 'default' | 'accent'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        variant === 'accent'
          ? 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
      )}
    >
      {children}
    </button>
  )
}

function LegendDot({ tone }: { tone: 'success' | 'marker' | 'primary' }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        tone === 'success' && 'bg-success',
        tone === 'marker' && 'bg-marker',
        tone === 'primary' && 'bg-primary',
      )}
    />
  )
}

function LocalSequenceView({
  ctx,
  sites,
  selectedSite,
  currentRewrite,
  stripRef,
  onSelectSite,
}: {
  ctx: SequenceContext
  sites: WggwSiteCandidate[]
  selectedSite: WggwSiteCandidate | null
  currentRewrite: WggwRecodingOption | null
  stripRef: React.RefObject<HTMLDivElement | null>
  onSelectSite: (site: WggwSiteCandidate) => void
}) {
  const visibleSites = useMemo(
    () =>
      sites.filter(
        (site) => site.motifStart <= ctx.end && site.motifStart + 3 >= ctx.start,
      ),
    [ctx.end, ctx.start, sites],
  )
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

  const templateColumns = `repeat(${ctx.bases.length}, minmax(0, 1fr))`

  return (
    <div className="space-y-1.5">
      <div className="text-muted-foreground flex justify-end px-1 font-mono text-[10px] leading-none tabular-nums">
        <span>
          bp {ctx.start.toLocaleString()}-{ctx.end.toLocaleString()}
        </span>
      </div>
      <div
        ref={stripRef}
        role="group"
        aria-label="Sequence context around WGGW split site"
        className="bg-muted/40 rounded-lg border p-3 font-mono text-[11px] leading-none shadow-sm"
      >
        <div
          className="relative z-10 grid h-8 gap-[1px]"
          style={{ gridTemplateColumns: templateColumns }}
          aria-hidden="true"
        >
          {ctx.codons.map((codon) => {
            const isMajorTick =
              codon.idx % RULER_LABEL_CODON_INTERVAL === 0
            return (
              <div
                key={`rail-${codon.idx}`}
                className="relative h-full"
                style={{
                  gridColumn: `${codon.columnStart} / ${codon.columnEnd}`,
                }}
              >
                {isMajorTick ? (
                  <span className="text-muted-foreground/75 absolute top-1 left-1/2 -translate-x-1/2 font-mono text-[9px] tabular-nums">
                    {(codon.start + 1).toLocaleString()}
                  </span>
                ) : (
                  <span className="absolute top-1 left-1/2 block h-2.5 w-px -translate-x-1/2 rounded-full bg-border/70" />
                )}
                <span
                  className={cn(
                    'text-muted-foreground/70 absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] tabular-nums',
                    codon.role === 'start' && 'text-success-soft font-semibold',
                    (codon.role === 'stop' ||
                      codon.role === 'internal-stop') &&
                      'text-danger-soft font-semibold',
                  )}
                  title={`Codon ${codon.idx + 1}: ${codon.codon}`}
                >
                  {codon.aa ?? '.'}
                </span>
              </div>
            )
          })}
        </div>

        <div className="relative mt-1">
          <div
            className="absolute inset-0 z-20 grid"
            style={{ gridTemplateColumns: templateColumns }}
          >
            {visibleSites.map((site, index) => {
              const isSelected = selectedSite?.position === site.position
              const visibleStart = Math.max(site.motifStart, ctx.start)
              const visibleEnd = Math.min(site.motifStart + 3, ctx.end)
              const columnStart = visibleStart - ctx.start + 1
              const columnSpan = visibleEnd - visibleStart + 1
              const boundaryPct =
                ((site.position - visibleStart) / columnSpan) * 100
              return (
                <button
                  type="button"
                  key={`${site.position}-${site.motifStart}`}
                  onClick={() => onSelectSite(site)}
                  title={`WGGW ${site.motif} · split between bp ${(site.position - 1).toLocaleString()} and ${site.position.toLocaleString()} · ${site.baseChanges} bp change${site.baseChanges === 1 ? '' : 's'}`}
                  aria-label={`Select WGGW ${formatMotifSplit(site.motif)} split between bp ${site.position - 1} and ${site.position}`}
                  className={cn(
                    'group relative h-9 cursor-pointer rounded-sm border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? 'z-30 border-primary/80 bg-primary/25 shadow-sm'
                      : 'border-marker/45 bg-marker/14 hover:z-20 hover:border-marker/80 hover:bg-marker/24',
                  )}
                  style={{
                    gridColumn: `${columnStart} / span ${columnSpan}`,
                    gridRow: '1 / 2',
                    zIndex: isSelected ? 30 : 10 + index,
                  }}
                >
                  <span
                    className={cn(
                      'absolute top-0 bottom-0 w-px -translate-x-1/2 transition-all group-hover:w-0.5',
                      isSelected ? 'bg-primary w-0.5' : 'bg-marker/90',
                    )}
                    style={{ left: `${boundaryPct}%` }}
                  />
                </button>
              )
            })}
          </div>
          <div
            className="border-border/60 bg-background/30 pointer-events-none relative z-30 grid overflow-hidden rounded-md border"
            style={{ gridTemplateColumns: templateColumns }}
          >
            {ctx.bases.map((base) => {
              const inSelected = selectedBases.has(base.position)
              const isChanged = selectedChangedBases.has(base.position)
              const isMotifG =
                selectedSite &&
                (base.position === selectedSite.motifStart + 1 ||
                  base.position === selectedSite.motifStart + 2)
              return (
                <div
                  key={base.position}
                  className={cn(
                    'text-muted-foreground flex h-9 items-center justify-center text-xs font-semibold tabular-nums',
                    base.role === 'start' && 'text-success-soft',
                    (base.role === 'stop' || base.role === 'internal-stop') &&
                      'text-danger-soft',
                    inSelected && 'text-primary',
                    isMotifG && 'text-foreground',
                    isChanged && 'underline decoration-2 underline-offset-4',
                  )}
                  title={`bp ${base.position.toLocaleString()}`}
                >
                  {base.base}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function CodonStrip({
  ctx,
  sites,
  selectedSite,
  currentRewrite,
  stripRef,
  onSnap,
}: {
  ctx: FrameContext
  sites: WggwSiteCandidate[]
  selectedSite: WggwSiteCandidate | null
  currentRewrite: WggwRecodingOption | null
  stripRef: React.RefObject<HTMLDivElement | null>
  onSnap: (position: number) => void
}) {
  const siteByFirstCodon = useMemo(() => {
    const map = new Map<number, WggwSiteCandidate>()
    for (const site of sites) {
      const firstCodonIdx = Math.floor((site.hexamerStart - 1) / 3)
      map.set(firstCodonIdx, site)
    }
    return map
  }, [sites])
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
    <div
      ref={stripRef}
      role="group"
      aria-label="Codon context around splice junction"
      className="bg-muted/40 rounded-lg border p-2 font-mono text-[11px] leading-none shadow-sm"
    >
      <div className="mb-1 flex w-full items-end gap-[1px]">
        {ctx.codons.map((c) => {
          const site = siteByFirstCodon.get(c.idx)
          const isSelected = site && selectedSite?.position === site.position
          return (
            <div
              key={`marker-${c.idx}`}
              className="flex h-3 flex-1 justify-center"
            >
              {site ? (
                <button
                  type="button"
                  onClick={() => onSnap(site.position)}
                  title={`WGGW ${site.motif} · bp ${site.position.toLocaleString()} · ${site.baseChanges} bp change${site.baseChanges === 1 ? '' : 's'}`}
                  aria-label={`Select WGGW site at bp ${site.position}`}
                  className="group flex h-full w-full cursor-pointer items-end justify-center"
                >
                  <span
                    className={cn(
                      'rounded-full transition-all group-hover:h-3',
                      isSelected ? 'bg-primary h-3 w-1.5' : 'bg-marker h-2 w-1',
                    )}
                  />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="flex w-full items-center gap-[1px]">
        {ctx.codons.map((c) => {
          const roleStyles = roleStylesFor(c.role)
          const isSelectedCodon = selectedCodonIndices.has(c.idx)
          return (
            <div
              key={c.idx}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-sm px-[3px] py-1',
                c.role === 'split' ? '' : roleStyles.container,
                isSelectedCodon && 'bg-marker/10 ring-marker/30 ring-1',
              )}
            >
              <span
                className={cn(
                  'tabular-nums',
                  roleStyles.aa,
                  isSelectedCodon && 'text-foreground',
                )}
              >
                {c.aa ?? '·'}
              </span>
              <span className="flex">
                {[0, 1, 2].map((bi) => {
                  const base = c.codon[bi]
                  const basePos = c.idx * 3 + bi + 1
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
                        inSelected && 'bg-marker/15 text-marker-soft',
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
    </div>
  )
}

function Inspector({
  selectedSite,
  currentRewrite,
  selectedRewriteIndex,
  onSelectRewrite,
}: {
  selectedSite: WggwSiteCandidate | null
  currentRewrite: WggwRecodingOption | null
  selectedRewriteIndex: number
  onSelectRewrite: (index: number) => void
}) {
  if (!selectedSite || !currentRewrite) {
    return (
      <div className="bg-muted/30 flex min-h-[228px] flex-col justify-center gap-2 rounded-lg border p-4 text-xs">
        <div className="text-foreground text-sm font-semibold">
          Pick a WGGW site
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Drag the caret to a nearby tick, click a tick directly, or press{' '}
          <Kbd>m</Kbd> to snap to the midpoint. Use <Kbd>[</Kbd> / <Kbd>]</Kbd>{' '}
          to step between sites.
        </p>
      </div>
    )
  }

  const peptide = translatePair(selectedSite.originalCodons)
  const splitMotif = formatMotifSplit(selectedSite.motif)
  const splitBoundary = `bp ${(selectedSite.position - 1).toLocaleString()} / ${selectedSite.position.toLocaleString()}`

  return (
    <div className="bg-muted/30 space-y-3 rounded-lg border p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground text-sm font-semibold">
          Selected split
        </span>
        <span className="bg-marker/15 text-marker-soft rounded-md px-2 py-0.5 font-mono text-xs font-semibold">
          {splitMotif}
        </span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {splitBoundary}
        </span>
        <span className="text-muted-foreground ml-auto font-mono text-[11px] tabular-nums">
          {selectedSite.fivePrimeLength.toLocaleString()} /{' '}
          {selectedSite.threePrimeLength.toLocaleString()}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatChip label={`${currentRewrite.baseChanges} bp Δ`} tone="neutral" />
        <StatChip label={`Peptide ${peptide}`} tone="neutral" />
        <StatChip
          label={frameBoundaryLabel(selectedSite.position)}
          tone="neutral"
        />
      </div>

      {selectedSite.rewriteOptions.length > 1 && (
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
            Synonymous rewrites
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedSite.rewriteOptions.map((option, index) => {
              const active = index === selectedRewriteIndex
              return (
                <button
                  type="button"
                  key={`${option.newHexamer}-${index}`}
                  onClick={() => onSelectRewrite(index)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:border-primary/30 hover:bg-background/60',
                  )}
                >
                  <span className="font-semibold">
                    {option.newHexamer.slice(0, 3)} {option.newHexamer.slice(3)}
                  </span>
                  <span className="bg-muted text-muted-foreground rounded px-1 text-[10px] font-medium">
                    {option.baseChanges}Δ
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <RewriteDiff
        beforeHexamer={selectedSite.originalHexamer}
        afterHexamer={currentRewrite.newHexamer}
        motifStart={currentRewrite.motifOffset}
        cutOffset={selectedSite.position - selectedSite.hexamerStart}
      />
    </div>
  )
}

function formatMotifSplit(motif: string) {
  return `${motif.slice(0, 2)}|${motif.slice(2)}`
}

function frameBoundaryLabel(position: number) {
  const basesBeforeBoundary = Math.max(0, position - 1)
  const frameOffset = basesBeforeBoundary % 3
  if (frameOffset === 0) return 'Between codons'
  return `After codon base ${frameOffset}`
}

function RewriteDiff({
  beforeHexamer,
  afterHexamer,
  motifStart,
  cutOffset,
}: {
  beforeHexamer: string
  afterHexamer: string
  motifStart: number
  cutOffset: number
}) {
  return (
    <div className="bg-background/80 space-y-1 rounded-md border p-2 font-mono text-[11px]">
      <DiffRow label="Before" hexamer={beforeHexamer} />
      <DiffRow
        label="After"
        hexamer={afterHexamer}
        changedFrom={beforeHexamer}
        motifStart={motifStart}
        cutOffset={cutOffset}
      />
    </div>
  )
}

function DiffRow({
  label,
  hexamer,
  changedFrom,
  motifStart,
  cutOffset,
}: {
  label: string
  hexamer: string
  changedFrom?: string
  motifStart?: number
  cutOffset?: number
}) {
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-2">
      <span className="text-muted-foreground text-[10px] tracking-[0.08em] uppercase">
        {label}
      </span>
      <div className="flex">
        {[...hexamer].map((base, index) => {
          const inMotif =
            motifStart !== undefined &&
            index >= motifStart &&
            index < motifStart + 4
          const isChanged = changedFrom ? changedFrom[index] !== base : false
          const isCut = cutOffset !== undefined && index === cutOffset
          return (
            <span
              key={index}
              className={cn(
                'px-[1px]',
                index === 3 && 'ml-1',
                inMotif && 'bg-marker/15 text-marker-soft',
                isChanged && 'underline decoration-2 underline-offset-2',
                isCut && 'border-primary border-r-2',
              )}
            >
              {base}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function StatChip({
  label,
  tone,
}: {
  label: string
  tone: 'success' | 'warning' | 'neutral'
}) {
  return (
    <span
      className={cn(
        'rounded-md border px-2 py-0.5 text-[11px] font-medium',
        tone === 'success' &&
          'border-success/30 bg-success/10 text-success-soft',
        tone === 'warning' && 'border-marker/30 bg-marker/10 text-marker-soft',
        tone === 'neutral' &&
          'border-border bg-background/60 text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="bg-background text-foreground inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border px-1 font-mono text-[10px] font-semibold">
      {children}
    </kbd>
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

function nearestSiteIndex(
  sites: WggwSiteCandidate[],
  position: number,
): number {
  if (sites.length === 0) return -1
  let bestIdx = 0
  let bestDist = Math.abs(sites[0].position - position)
  for (let i = 1; i < sites.length; i++) {
    const d = Math.abs(sites[i].position - position)
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  return bestIdx
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
        container: 'bg-success/15 ring-success/40 ring-1',
        aa: 'text-success-soft font-semibold',
        base: 'text-success-soft',
      }
    case 'stop':
      return {
        container: 'bg-danger/15 ring-danger/40 ring-1',
        aa: 'text-danger-soft font-semibold',
        base: 'text-danger-soft',
      }
    case 'internal-stop':
      return {
        container: 'bg-danger/20 ring-danger/50 ring-1',
        aa: 'text-danger-soft font-semibold',
        base: 'text-danger-soft',
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

interface SequenceContext {
  start: number
  end: number
  position: number
  cutPct: number
  bases: {
    base: string
    position: number
    role: CodonRole
  }[]
  codons: {
    codon: string
    aa: string | null
    idx: number
    start: number
    end: number
    columnStart: number
    columnEnd: number
    role: CodonRole
  }[]
}

function cutPercent(position: number, start: number, baseCount: number) {
  if (baseCount <= 0) return 0
  return Math.max(0, Math.min(100, ((position - start) / baseCount) * 100))
}

function buildSequenceContext(
  sequence: string,
  position: number,
  contextWindow: number,
): SequenceContext {
  const upper = sequence.toUpperCase().replace(/U/g, 'T')
  const seqLen = upper.length
  const clampedPosition = Math.max(1, Math.min(seqLen, position))
  const start = Math.max(1, clampedPosition - contextWindow)
  const end = Math.min(seqLen, clampedPosition + contextWindow - 1)
  const bases: SequenceContext['bases'] = []

  for (let pos = start; pos <= end; pos++) {
    const codonIdx = Math.floor((pos - 1) / 3)
    const codonStart = codonIdx * 3 + 1
    const codon = upper.slice(codonStart - 1, codonStart + 2)
    const aa = codon.length === 3 ? translateCodon(codon) : null
    let role: CodonRole = 'context'
    if (codonStart === 1) role = 'start'
    else if (codonStart + 2 >= seqLen && aa === '*') role = 'stop'
    else if (aa === '*') role = 'internal-stop'
    bases.push({ base: upper[pos - 1] ?? '.', position: pos, role })
  }

  const firstCodonIdx = Math.floor((start - 1) / 3)
  const lastCodonIdx = Math.floor((end - 1) / 3)
  const codons: SequenceContext['codons'] = []
  for (let idx = firstCodonIdx; idx <= lastCodonIdx; idx++) {
    const codonStart = idx * 3 + 1
    const codonEnd = codonStart + 2
    const codon = upper.slice(codonStart - 1, codonStart + 2)
    const aa = codon.length === 3 ? translateCodon(codon) : null
    let role: CodonRole = 'context'
    if (codonStart === 1) role = 'start'
    else if (codonEnd >= seqLen && aa === '*') role = 'stop'
    else if (aa === '*') role = 'internal-stop'
    codons.push({
      codon,
      aa,
      idx,
      start: codonStart,
      end: codonEnd,
      columnStart: Math.max(codonStart, start) - start + 1,
      columnEnd: Math.min(codonEnd, end) - start + 2,
      role,
    })
  }

  return {
    start,
    end,
    position: clampedPosition,
    cutPct: cutPercent(clampedPosition, start, bases.length),
    bases,
    codons,
  }
}

interface FrameContext {
  splitCodon: number
  frameOffset: number
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
  const cut = Math.max(0, position - 1)
  const splitCodon = Math.floor(cut / 3)
  const frameOffset = cut % 3
  const totalCodons = Math.floor(upper.length / 3)
  const lastCodonIdx = totalCodons - 1

  let start = Math.max(0, splitCodon - contextWindow)
  let end = Math.min(totalCodons, splitCodon + contextWindow + 1)
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

function translatePair(codons: [string, string]) {
  return codons.map((codon) => translateCodon(codon) ?? '?').join('')
}

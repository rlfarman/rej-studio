'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
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
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const frameStripRef = useRef<HTMLDivElement>(null)
  const [shortcutsActive, setShortcutsActive] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)

  const wggwSites = useMemo<WggwSiteCandidate[]>(() => {
    if (seqLen < 12) return []
    return groupWggwSites(rankInducibleWggwByBalance(sequence))
  }, [sequence, seqLen])
  const normalizedSequence = useMemo(
    () => sequence.toUpperCase().replace(/U/g, 'T'),
    [sequence],
  )
  const normalizedSearch = useMemo(
    () =>
      searchValue
        .toUpperCase()
        .replace(/U/g, 'T')
        .replace(/[^ACGT]/g, ''),
    [searchValue],
  )
  const searchMatches = useMemo(
    () => findSequenceMatches(normalizedSequence, normalizedSearch),
    [normalizedSearch, normalizedSequence],
  )

  const midpoint = Math.max(1, Math.min(seqLen - 1, Math.floor(seqLen / 2)))

  const siteAtPosition = useMemo(
    () => wggwSites.find((site) => site.position === position) ?? null,
    [position, wggwSites],
  )
  const [activeSitePosition, setActiveSitePosition] = useState<number | null>(
    null,
  )
  const selectedSite = useMemo(
    () =>
      wggwSites.find((site) => site.position === activeSitePosition) ?? null,
    [activeSitePosition, wggwSites],
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

  const handleSelectSite = useCallback(
    (site: WggwSiteCandidate) => {
      setActiveSitePosition(site.position)
      onSnap(site.position)
    },
    [onSnap],
  )

  const jumpToSibling = useCallback(
    (dir: -1 | 1) => {
      if (wggwSites.length === 0) return
      if (selectedSiteIndex === -1) {
        const next = nearestSiteIndex(wggwSites, position)
        if (next !== -1) handleSelectSite(wggwSites[next])
        return
      }
      const target = selectedSiteIndex + dir
      if (target < 0 || target >= wggwSites.length) return
      handleSelectSite(wggwSites[target])
    },
    [handleSelectSite, position, selectedSiteIndex, wggwSites],
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

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      setShortcutsActive(!!target && !!rootRef.current?.contains(target))
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null
      setShortcutsActive(!!target && !!rootRef.current?.contains(target))
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (!shortcutsActive) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable)
      ) {
        return
      }

      if (event.key === '[') {
        event.preventDefault()
        jumpToSibling(-1)
        return
      }
      if (event.key === ']') {
        event.preventDefault()
        jumpToSibling(1)
        return
      }
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault()
        onSnap(midpoint)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('focusin', handleFocusIn)
    window.addEventListener('keydown', handleWindowKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('focusin', handleFocusIn)
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [jumpToSibling, midpoint, onSnap, shortcutsActive])

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

  const jumpToPosition = (nextPosition: number) => {
    onSnap(Math.max(1, Math.min(seqLen - 1, nextPosition)))
  }

  const handleJumpSubmit = () => {
    const parsed = Number.parseInt(jumpValue, 10)
    if (Number.isNaN(parsed)) return
    jumpToPosition(parsed)
  }

  const jumpToSearchMatch = (nextIndex: number) => {
    if (searchMatches.length === 0) return
    const normalizedIndex =
      ((nextIndex % searchMatches.length) + searchMatches.length) %
      searchMatches.length
    setSearchMatchIndex(normalizedIndex)
    const match = searchMatches[normalizedIndex]
    const target = match.start + Math.floor(match.length / 2)
    jumpToPosition(target)
  }

  if (seqLen < 12) return null

  return (
    <div
      ref={rootRef}
      className="space-y-2"
      onPointerDownCapture={() => setShortcutsActive(true)}
      onFocusCapture={() => setShortcutsActive(true)}
    >
      <Toolbar
        total={wggwSites.length}
        currentIndex={selectedSiteIndex >= 0 ? selectedSiteIndex + 1 : 0}
        jumpValue={jumpValue}
        searchValue={searchValue}
        searchMatchCount={searchMatches.length}
        searchMatchIndex={searchMatchIndex}
        onJumpChange={setJumpValue}
        onJumpSubmit={handleJumpSubmit}
        onSearchChange={(value) => {
          setSearchValue(value)
          setSearchMatchIndex(0)
        }}
        onSearchNext={() => jumpToSearchMatch(searchMatchIndex + 1)}
        onSearchPrev={() => jumpToSearchMatch(searchMatchIndex - 1)}
        onSearchSubmit={() => jumpToSearchMatch(searchMatchIndex)}
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

      <div className="space-y-2">
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
            className="focus-visible:ring-ring bg-background/80 relative h-16 cursor-ew-resize touch-none rounded-lg border select-none focus:outline-none focus-visible:ring-2"
          >
            <div className="absolute inset-x-0 top-0 flex h-11 overflow-hidden rounded-t-lg">
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
            <div className="bg-background/70 absolute inset-x-0 bottom-0 h-5 overflow-hidden rounded-b-lg border-t">
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
          sequence={sequence}
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
  currentIndex,
  jumpValue,
  searchValue,
  searchMatchCount,
  searchMatchIndex,
  onJumpChange,
  onJumpSubmit,
  onSearchChange,
  onSearchPrev,
  onSearchNext,
  onSearchSubmit,
  onPrev,
  onNext,
  onMidpoint,
  canPrev,
  canNext,
}: {
  total: number
  currentIndex: number
  jumpValue: string
  searchValue: string
  searchMatchCount: number
  searchMatchIndex: number
  onJumpChange: (value: string) => void
  onJumpSubmit: () => void
  onSearchChange: (value: string) => void
  onSearchPrev: () => void
  onSearchNext: () => void
  onSearchSubmit: () => void
  onPrev: () => void
  onNext: () => void
  onMidpoint: () => void
  canPrev: boolean
  canNext: boolean
}) {
  return (
    <div className="bg-background/25 grid w-full gap-x-3 gap-y-1 rounded-sm px-1 py-0.5 md:grid-cols-3 md:items-center">
      <div className="min-w-0">
        <ToolbarSection label="Find">
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (event.shiftKey) onSearchPrev()
                else onSearchSubmit()
              }
            }}
            className="bg-background h-5 w-16 rounded-sm border px-1 font-mono text-[10px] uppercase outline-none"
            placeholder="ACGT"
            aria-label="Search sequence"
          />
          <ToolbarButton
            onClick={onSearchPrev}
            disabled={searchMatchCount === 0}
            title="Previous search match"
            compact
          >
            <ChevronLeft className="size-3" />
          </ToolbarButton>
          {searchValue && (
            <span className="text-muted-foreground min-w-8 text-center font-mono text-[10px] tabular-nums">
              {searchMatchCount === 0
                ? '0/0'
                : `${searchMatchIndex + 1}/${searchMatchCount}`}
            </span>
          )}
          {!searchValue && (
            <span className="text-muted-foreground min-w-8 text-center font-mono text-[10px] tabular-nums">
              0/0
            </span>
          )}
          <ToolbarButton
            onClick={onSearchNext}
            disabled={searchMatchCount === 0}
            title="Next search match"
            compact
          >
            <ChevronRight className="size-3" />
          </ToolbarButton>
        </ToolbarSection>
      </div>

      <div className="min-w-0">
        <ToolbarSection label="Jump">
          <ToolbarButton
            onClick={onMidpoint}
            title="Snap to midpoint (m)"
            variant="accent"
            compact
          >
            Midpoint
          </ToolbarButton>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[10px] font-medium">
              bp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={jumpValue}
              onChange={(event) =>
                onJumpChange(event.target.value.replace(/[^\d]/g, ''))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onJumpSubmit()
                }
              }}
              className="bg-background h-5 w-12 rounded-sm border px-1 font-mono text-[10px] outline-none"
              placeholder="742"
              aria-label="Jump to base-pair position"
            />
            <ToolbarButton onClick={onJumpSubmit} title="Jump to bp" compact>
              Go
            </ToolbarButton>
          </div>
        </ToolbarSection>
      </div>

      <div className="min-w-0 md:justify-self-end">
        <ToolbarSection label="Sites">
          <ToolbarButton
            onClick={onPrev}
            disabled={!canPrev}
            title="Previous WGGW site ([)"
            compact
          >
            <ChevronLeft className="size-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={onNext}
            disabled={!canNext}
            title="Next WGGW site (])"
            compact
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-3.5" />
          </ToolbarButton>
          <span className="text-muted-foreground min-w-12 text-center font-mono text-[10px] tabular-nums">
            {currentIndex}/{total}
          </span>
        </ToolbarSection>
      </div>
    </div>
  )
}

function ToolbarSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-1">
      <span className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1">
        <div className="bg-border/70 h-4 w-px shrink-0" aria-hidden="true" />
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {children}
        </div>
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
  compact = false,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
  variant?: 'default' | 'accent'
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        compact
          ? 'inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium transition-colors'
          : 'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors',
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
        (site) =>
          site.motifStart <= ctx.end && site.motifStart + 3 >= ctx.start,
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
      <div
        ref={stripRef}
        role="group"
        aria-label="Sequence context around WGGW split site"
        className="bg-muted/40 rounded-lg border p-3 font-mono text-[11px] leading-none"
      >
        <div
          className="relative z-10 grid h-8 gap-[1px]"
          style={{ gridTemplateColumns: templateColumns }}
          aria-hidden="true"
        >
          {ctx.codons.map((codon) => {
            const hasBoundaryLabel =
              codon.idx < ctx.codons[ctx.codons.length - 1].idx &&
              (codon.idx + 1) % RULER_LABEL_CODON_INTERVAL === 0
            const boundaryPosition = codon.end + 1
            return (
              <div
                key={`rail-${codon.idx}`}
                className="relative h-full"
                style={{
                  gridColumn: `${codon.columnStart} / ${codon.columnEnd}`,
                }}
              >
                {hasBoundaryLabel ? (
                  <span className="text-muted-foreground/75 absolute top-1 left-full -translate-x-1/2 font-mono text-[9px] tabular-nums">
                    {boundaryPosition.toLocaleString()}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'text-muted-foreground/70 absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] tabular-nums',
                    codon.role === 'start' && 'text-success-soft font-semibold',
                    (codon.role === 'stop' || codon.role === 'internal-stop') &&
                      'text-danger-soft font-semibold',
                  )}
                  title={`Codon ${codon.idx + 1}: ${codon.codon}`}
                >
                  {codon.aa ?? '.'}
                </span>
                {codon.idx < ctx.codons[ctx.codons.length - 1].idx && (
                  <span className="bg-border/70 absolute bottom-[2px] left-full h-2.5 w-px -translate-x-1/2 rounded-full" />
                )}
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
                    'group focus-visible:ring-ring relative flex h-full cursor-pointer items-center overflow-hidden rounded-sm border transition-all focus:outline-none focus-visible:ring-2',
                    isSelected
                      ? 'border-primary/80 bg-primary/25 z-30 shadow-sm'
                      : 'border-marker/45 bg-marker/14 hover:border-marker/80 hover:bg-marker/24 hover:z-20',
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
              const selectedMotifStart = selectedSite?.motifStart
              const isSelectedStart =
                selectedMotifStart !== undefined &&
                selectedMotifStart === base.position
              const isSelectedEnd =
                selectedMotifStart !== undefined &&
                selectedMotifStart + 3 === base.position
              const isMotifG =
                selectedMotifStart !== undefined &&
                (base.position === selectedMotifStart + 1 ||
                  base.position === selectedMotifStart + 2)
              return (
                <div
                  key={base.position}
                  className={cn(
                    'text-muted-foreground flex h-9 items-center justify-center text-xs font-semibold tabular-nums',
                    base.role === 'start' && 'text-success-soft',
                    (base.role === 'stop' || base.role === 'internal-stop') &&
                      'text-danger-soft',
                    inSelected && 'bg-primary/15 text-primary',
                    inSelected && isSelectedStart && 'rounded-l-sm',
                    inSelected && isSelectedEnd && 'rounded-r-sm',
                    isMotifG && 'text-foreground',
                    isChanged && 'text-primary',
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
                isSelectedCodon && 'bg-primary/10 ring-primary/30 ring-1',
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
                        inSelected && 'bg-primary/15 text-primary',
                        isChanged && 'text-primary',
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
  sequence,
  selectedSite,
  currentRewrite,
  selectedRewriteIndex,
  onSelectRewrite,
}: {
  sequence: string
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

  const rewrittenSequence = applyRewriteToSequence(
    sequence,
    selectedSite.hexamerStart,
    currentRewrite.newHexamer,
  )
  const editedPositions = getEditedPositions(selectedSite, currentRewrite)
  const originalSplitContext = buildSplitContext(
    sequence,
    selectedSite.position,
    selectedSite.motifStart,
    editedPositions,
  )
  const designedSplitContext = buildSplitContext(
    rewrittenSequence,
    selectedSite.position,
    selectedSite.motifStart,
    editedPositions,
  )

  return (
    <div className="bg-muted/30 space-y-4 rounded-lg border p-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground text-sm font-semibold">
          Selected split
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[11.5rem_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
            Synonymous rewrites
          </div>
          <div className="flex flex-col gap-1.5">
            {selectedSite.rewriteOptions.map((option, index) => {
              const active = index === selectedRewriteIndex
              return (
                <button
                  type="button"
                  key={`${option.newHexamer}-${index}`}
                  onClick={() => onSelectRewrite(index)}
                  className={cn(
                    'grid min-w-[11.5rem] grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 self-start rounded-md border px-3 py-2.5 font-mono text-[12px] transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:border-primary/30 hover:bg-background/60',
                  )}
                >
                  <span aria-hidden="true" />
                  <span className="flex flex-col items-center gap-0.5 leading-tight">
                    <span
                      className="grid font-mono text-[12px] leading-none"
                      style={{ gridTemplateColumns: 'repeat(7, 1ch)' }}
                    >
                      <span className="text-muted-foreground/80 col-start-2 text-center font-medium">
                        {translateCodon(option.newCodons[0]) ?? '?'}
                      </span>
                      <span className="text-muted-foreground/80 col-start-6 text-center font-medium">
                        {translateCodon(option.newCodons[1]) ?? '?'}
                      </span>
                    </span>
                    <span
                      className="grid font-mono leading-none font-semibold"
                      style={{ gridTemplateColumns: 'repeat(7, 1ch)' }}
                    >
                      <span className="col-span-3 text-center">
                        {option.newCodons[0]}
                      </span>
                      <span className="col-span-3 col-start-5 text-center">
                        {option.newCodons[1]}
                      </span>
                    </span>
                  </span>
                  <span className="flex justify-end">
                    {option.baseChanges === 0 && (
                      <span className="border-primary/25 bg-primary/10 text-primary rounded border px-1 py-px text-[9px] font-medium tracking-[0.04em] uppercase">
                        Native
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
            Sequence context
          </div>
          <div className="bg-background/80 space-y-1 rounded-md border px-3 py-2.5">
            <AlignedAaRow
              label="AA"
              guide={buildAminoAcidGuide(
                sequence,
                originalSplitContext.windowStart,
                originalSplitContext.windowEnd,
                selectedSite.position,
              )}
            />
            <AlignedSequenceRow
              label="Original sequence"
              context={originalSplitContext}
            />
            <AlignedSequenceRow
              label="Designed sequence"
              context={designedSplitContext}
            />
            <AlignedAaRow
              label="Motif"
              guide={buildMotifGuide(
                designedSplitContext.displayText,
                designedSplitContext.boundaryIndexes,
              )}
              hideBoundaries
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function formatMotifSplit(motif: string) {
  return `${motif.slice(0, 2)}|${motif.slice(2)}`
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="bg-background text-foreground inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border px-1 font-mono text-[10px] font-semibold">
      {children}
    </kbd>
  )
}

function AlignedAaRow({
  label,
  guide,
  hideBoundaries = false,
}: {
  label: string
  guide: ReturnType<typeof buildAminoAcidGuide>
  hideBoundaries?: boolean
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 font-mono text-[14px] leading-[1.2]">
      <div className="text-muted-foreground pt-[1px] text-[10px] font-medium tracking-[0.08em] uppercase">
        {label}
      </div>
      <SequenceGuideText
        text={guide.text}
        boundaryIndexes={guide.boundaryIndexes}
        hideBoundaries={hideBoundaries}
      />
    </div>
  )
}

function AlignedSequenceRow({
  label,
  context,
}: {
  label: string
  context: ReturnType<typeof buildSplitContext>
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 font-mono text-[14px] leading-[1.2]">
      <div className="text-muted-foreground pt-[1px] text-[10px] font-medium tracking-[0.08em] whitespace-nowrap uppercase">
        {label}
      </div>
      <SequenceGuideText
        text={context.displayText}
        boundaryIndexes={context.boundaryIndexes}
        editedIndexes={context.displayEditedIndexes}
      />
    </div>
  )
}

function SequenceGuideText({
  text,
  boundaryIndexes,
  editedIndexes = [],
  hideBoundaries = false,
}: {
  text: string
  boundaryIndexes: number[]
  editedIndexes?: number[]
  hideBoundaries?: boolean
}) {
  const editedSet = new Set(editedIndexes)
  const boundarySet = new Set(boundaryIndexes)

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex items-stretch whitespace-pre">
        {[...text].map((char, index) => (
          <Fragment key={`${char}-${index}`}>
            <span
              className={cn(
                'inline-flex min-w-[1ch] items-center justify-center',
                char === '|' && 'text-primary font-bold',
                editedSet.has(index) && 'font-semibold',
              )}
            >
              {char}
            </span>
            {boundarySet.has(index) && (
              <span
                className="inline-flex w-[3px] items-center justify-center"
                aria-hidden="true"
              >
                <span
                  className={cn(
                    'h-[1.05em] w-px',
                    hideBoundaries ? 'bg-transparent' : 'bg-border/80',
                  )}
                />
              </span>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function HighlightedSequence({
  text,
  highlightStart,
  highlightEnd,
  editedIndexes = [],
  separatorIndexes = [],
}: {
  text: string
  highlightStart: number
  highlightEnd: number
  editedIndexes?: number[]
  separatorIndexes?: number[]
}) {
  let baseIndex = 0
  const editedSet = new Set(editedIndexes)

  return (
    <>
      {[...text].map((char, index) => {
        if (
          (separatorIndexes.includes(baseIndex) && char === ' ') ||
          char === '|'
        ) {
          return <span key={`${char}-${index}`}>{char}</span>
        }

        const isHighlighted =
          baseIndex >= highlightStart && baseIndex < highlightEnd
        const isEdited = editedSet.has(baseIndex)
        baseIndex++

        return (
          <span
            key={`${char}-${index}`}
            className={cn(
              isHighlighted && 'bg-marker/15 font-semibold',
              isEdited && 'text-primary',
            )}
          >
            {char}
          </span>
        )
      })}
    </>
  )
}

function applyRewriteToSequence(
  sequence: string,
  hexamerStart: number,
  newHexamer: string,
) {
  const startIndex = hexamerStart - 1
  return (
    sequence.slice(0, startIndex) +
    newHexamer +
    sequence.slice(startIndex + newHexamer.length)
  )
}

function buildSplitContext(
  sequence: string,
  position: number,
  motifStart: number,
  editedPositions: Set<number>,
) {
  const leftStart = Math.max(1, position - 15)
  const rightEnd = Math.min(sequence.length, position + 14)
  const left = sequence.slice(leftStart - 1, position - 1)
  const right = sequence.slice(position - 1, rightEnd)
  const text = `${left}|${right}`
  const displayCoreText = text
  const displayText = `...${displayCoreText}...`
  const boundaryIndexes = getCodonBoundaryDisplayIndexes(
    leftStart,
    rightEnd,
    position,
    3,
  )
  const highlightStart = Math.max(0, motifStart - leftStart)
  const highlightEnd = Math.min(text.length, highlightStart + 5)
  const editedIndexes = [...editedPositions]
    .filter((pos) => pos >= leftStart && pos <= rightEnd)
    .map((pos) => pos - leftStart)
  const displayEditedIndexes = editedIndexes.map((index) =>
    index >= position - leftStart ? index + 4 : index + 3,
  )

  return {
    text,
    displayText,
    boundaryIndexes,
    highlightStart,
    highlightEnd,
    editedIndexes,
    displayEditedIndexes,
    windowStart: leftStart,
    windowEnd: rightEnd,
  }
}

function translatePair(codons: [string, string]) {
  return codons.map((codon) => translateCodon(codon) ?? '?').join('')
}

function buildAminoAcidGuide(
  sequence: string,
  windowStart: number,
  windowEnd: number,
  splitPosition: number,
) {
  const upper = sequence.toUpperCase().replace(/U/g, 'T')
  return {
    ...formatAminoAcidGuideText(upper, windowStart, windowEnd, splitPosition),
  }
}

function formatAminoAcidGuideText(
  sequence: string,
  windowStart: number,
  windowEnd: number,
  splitPosition: number,
) {
  const coreText = buildDisplayCoreText(windowStart, windowEnd, splitPosition)
  const chars: string[] = [...`...${coreText}...`].map((char) =>
    char === '|' ? '|' : ' ',
  )
  const boundaryIndexes = getCodonBoundaryDisplayIndexes(
    windowStart,
    windowEnd,
    splitPosition,
    3,
  )

  const firstCodonStart = Math.floor((windowStart - 1) / 3) * 3 + 1
  for (
    let codonStart = firstCodonStart;
    codonStart <= windowEnd - 2;
    codonStart += 3
  ) {
    const codonEnd = codonStart + 2
    if (codonStart < windowStart || codonEnd > windowEnd) continue
    const aa = translateCodon(sequence.slice(codonStart - 1, codonEnd)) ?? '.'
    const midpoint = codonStart + 1
    const displayIndex = getDisplayIndexForPosition(
      midpoint,
      windowStart,
      splitPosition,
    )
    chars[displayIndex] = aa
  }

  return { text: chars.join(''), boundaryIndexes }
}

function buildMotifGuide(displayText: string, boundaryIndexes: number[]) {
  const chars: string[] = [...displayText].map(() => ' ')
  const splitIndex = displayText.indexOf('|')
  if (splitIndex === -1) {
    return { text: chars.join(''), boundaryIndexes }
  }

  chars[splitIndex - 2] = 'W'
  chars[splitIndex - 1] = 'G'
  chars[splitIndex] = '|'
  chars[splitIndex + 1] = 'G'
  chars[splitIndex + 2] = 'W'

  return {
    text: chars.join(''),
    boundaryIndexes,
  }
}

function getDisplayIndexForPosition(
  position: number,
  windowStart: number,
  splitPosition: number,
) {
  let index = 3
  for (let pos = windowStart; pos < position; pos++) {
    if (pos === splitPosition) index++
    index++
  }
  if (position === splitPosition) index++
  return index
}

function buildDisplayCoreText(
  windowStart: number,
  windowEnd: number,
  splitPosition: number,
) {
  const chars: string[] = []
  for (let pos = windowStart; pos <= windowEnd; pos++) {
    if (pos === splitPosition) chars.push('|')
    chars.push(' ')
  }
  return chars.join('')
}

function getCodonBoundaryDisplayIndexes(
  windowStart: number,
  windowEnd: number,
  splitPosition: number,
  prefixLength: number,
) {
  const indexes: number[] = []
  for (let pos = windowStart; pos < windowEnd; pos++) {
    if (pos === splitPosition - 1) continue
    if (pos % 3 !== 0) continue
    let index = prefixLength
    for (let cursor = windowStart; cursor <= pos; cursor++) {
      if (cursor === splitPosition) index++
      index++
    }
    indexes.push(index - 1)
  }
  return indexes
}

function getEditedIndexesForHexamer(
  originalHexamer: string,
  nextHexamer: string,
) {
  const editedIndexes: number[] = []
  for (let i = 0; i < originalHexamer.length; i++) {
    if (originalHexamer[i] !== nextHexamer[i]) editedIndexes.push(i)
  }
  return editedIndexes
}

function getEditedPositions(
  selectedSite: WggwSiteCandidate,
  currentRewrite: WggwRecodingOption,
) {
  const positions = new Set<number>()
  for (const index of getEditedIndexesForHexamer(
    selectedSite.originalHexamer,
    currentRewrite.newHexamer,
  )) {
    positions.add(selectedSite.hexamerStart + index)
  }
  return positions
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

function findSequenceMatches(sequence: string, query: string) {
  if (!query) return []
  const matches: Array<{ start: number; length: number }> = []
  let startIndex = 0
  while (startIndex < sequence.length) {
    const foundIndex = sequence.indexOf(query, startIndex)
    if (foundIndex === -1) break
    matches.push({ start: foundIndex + 1, length: query.length })
    startIndex = foundIndex + 1
  }
  return matches
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
  const desiredWindowSize = Math.max(1, contextWindow * 2)
  const centeredStart = Math.max(1, clampedPosition - contextWindow)
  const maxStart = Math.max(1, seqLen - desiredWindowSize + 1)
  const start = Math.min(centeredStart, maxStart)
  const end = Math.min(seqLen, start + desiredWindowSize - 1)
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

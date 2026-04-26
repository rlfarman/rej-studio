'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
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
  const [queryValue, setQueryValue] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)
  const [stripWindow, setStripWindow] = useState<{
    start: number
    end: number
  } | null>(null)

  useEffect(() => {
    const el = frameStripRef.current
    if (!el) return
    const update = () => {
      if (el.scrollWidth <= el.clientWidth + 1) {
        setStripWindow(null)
        return
      }
      const startFrac = el.scrollLeft / el.scrollWidth
      const endFrac = (el.scrollLeft + el.clientWidth) / el.scrollWidth
      setStripWindow({
        start: Math.max(1, Math.floor(startFrac * seqLen) + 1),
        end: Math.min(seqLen, Math.ceil(endFrac * seqLen)),
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [seqLen])
  const queryMode = detectQueryMode(queryValue)
  const searchValue = queryMode === 'sequence' ? queryValue : ''

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
  const activeSearchMatch =
    searchMatches.length > 0 ? (searchMatches[searchMatchIndex] ?? null) : null

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

  const frameContext = useMemo(() => buildSequenceContext(sequence), [sequence])

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

  const positionPct = splitPositionToPercent(position, seqLen)
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

  const scrollStripToPosition = (pos: number) => {
    const scroller = frameStripRef.current
    if (!scroller || seqLen <= 0) return
    const targetCenter = ((pos - 0.5) / seqLen) * scroller.scrollWidth
    scroller.scrollLeft = targetCenter - scroller.clientWidth / 2
  }

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    target.focus()
    const initial = positionFromPointer(e.clientX)
    onSnap(initial)
    scrollStripToPosition(initial)
    const handleMove = (ev: PointerEvent) => {
      const next = positionFromPointer(ev.clientX)
      onSnap(next)
      scrollStripToPosition(next)
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

  const handleQuerySubmit = () => {
    if (queryMode === 'bp') {
      const parsed = Number.parseInt(queryValue, 10)
      if (Number.isNaN(parsed)) return
      jumpToPosition(parsed)
    } else if (queryMode === 'sequence') {
      jumpToSearchMatch(searchMatchIndex)
    }
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
        queryValue={queryValue}
        queryMode={queryMode}
        searchMatchCount={searchMatches.length}
        searchMatchIndex={searchMatchIndex}
        onQueryChange={(value) => {
          setQueryValue(value)
          setSearchMatchIndex(0)
        }}
        onQuerySubmit={handleQuerySubmit}
        onSearchNext={() => jumpToSearchMatch(searchMatchIndex + 1)}
        onSearchPrev={() => jumpToSearchMatch(searchMatchIndex - 1)}
        onMidpoint={() => onSnap(midpoint)}
      />

      <div className="space-y-2">
        <div className="flex min-w-0 flex-col gap-2">
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
            <div className="absolute inset-x-0 top-0 z-10 flex h-11 overflow-hidden rounded-t-lg">
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
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-0 -translate-x-1/2"
                style={{ left: `${positionPct}%` }}
                aria-hidden="true"
              >
                <div className="absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      jumpToSibling(-1)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    disabled={
                      !(
                        selectedSiteIndex > 0 ||
                        (selectedSiteIndex === -1 && wggwSites.length > 0)
                      )
                    }
                    title="Previous WGGW site ([)"
                    aria-label="Previous WGGW site"
                    className="text-foreground/55 hover:text-foreground pointer-events-auto inline-flex size-4 cursor-pointer items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="size-3" strokeWidth={2.5} />
                  </button>
                  <div className="bg-background text-foreground inline-flex min-w-max items-center rounded-md border px-2.5 py-1 font-mono text-xs font-semibold whitespace-nowrap tabular-nums shadow-sm">
                    {position.toLocaleString()} bp
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      jumpToSibling(1)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    disabled={
                      !(
                        (selectedSiteIndex >= 0 &&
                          selectedSiteIndex < wggwSites.length - 1) ||
                        (selectedSiteIndex === -1 && wggwSites.length > 0)
                      )
                    }
                    title="Next WGGW site (])"
                    aria-label="Next WGGW site"
                    className="text-foreground/55 hover:text-foreground pointer-events-auto inline-flex size-4 cursor-pointer items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRight className="size-3" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-background/70 absolute inset-x-0 bottom-0 h-5 overflow-hidden rounded-b-lg border-t">
              {stripWindow && (
                <div
                  className="bg-foreground/8 pointer-events-none absolute inset-y-0"
                  style={{
                    left: `${((stripWindow.start - 1) / seqLen) * 100}%`,
                    width: `${((stripWindow.end - stripWindow.start + 1) / seqLen) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              )}
              {wggwSites.map((site, i) => {
                const x = splitPositionToPercent(site.position, seqLen)
                const isSelected = selectedSite?.position === site.position
                const costTone = costToneFor(site.baseChanges)
                return (
                  <button
                    type="button"
                    key={`${site.position}-${i}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectSite(site)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-pressed={isSelected}
                    title={`WGGW ${site.motif} · bp ${site.position.toLocaleString()} · ${site.baseChanges} bp change${site.baseChanges === 1 ? '' : 's'}`}
                    className="group absolute top-0 flex h-full w-7 -translate-x-1/2 cursor-pointer items-center justify-center"
                    style={{ left: `${x}%` }}
                  >
                    <span
                      className={cn(
                        'rounded-full transition-all group-hover:h-4',
                        isSelected
                          ? 'bg-primary h-4 w-1.5'
                          : cn(costTone.tickBg, 'h-3 w-1'),
                      )}
                    />
                  </button>
                )
              })}
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-0 w-0 -translate-x-1/2"
              style={{ left: `${positionPct}%` }}
              aria-hidden="true"
            >
              <div className="border-foreground/85 absolute inset-y-0 left-1/2 z-0 -translate-x-1/2 border-l-2" />
            </div>
          </div>

          <LocalSequenceView
            ctx={frameContext}
            sites={wggwSites}
            selectedSite={selectedSite}
            currentRewrite={currentRewrite}
            activeSearchMatch={activeSearchMatch}
            cursorPosition={position}
            stripRef={frameStripRef}
            onSelectSite={handleSelectSite}
          />
          <div className="flex justify-end px-1">
            <ShortcutHint
              active={shortcutsActive}
              canPrev={
                selectedSiteIndex > 0 ||
                (selectedSiteIndex === -1 && wggwSites.length > 0)
              }
              canNext={
                (selectedSiteIndex >= 0 &&
                  selectedSiteIndex < wggwSites.length - 1) ||
                (selectedSiteIndex === -1 && wggwSites.length > 0)
              }
              onPrev={() => jumpToSibling(-1)}
              onNext={() => jumpToSibling(1)}
              onMidpoint={() => onSnap(midpoint)}
            />
          </div>
        </div>

        <Inspector
          sequence={sequence}
          selectedSite={selectedSite}
          selectedSiteIndex={selectedSiteIndex}
          totalSites={wggwSites.length}
          currentRewrite={currentRewrite}
          selectedRewriteIndex={selectedRewriteIndex}
          canPrevSite={
            selectedSiteIndex > 0 ||
            (selectedSiteIndex === -1 && wggwSites.length > 0)
          }
          canNextSite={
            (selectedSiteIndex >= 0 &&
              selectedSiteIndex < wggwSites.length - 1) ||
            (selectedSiteIndex === -1 && wggwSites.length > 0)
          }
          onPrevSite={() => jumpToSibling(-1)}
          onNextSite={() => jumpToSibling(1)}
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

type QueryMode = 'idle' | 'bp' | 'sequence'

function detectQueryMode(value: string): QueryMode {
  const trimmed = value.trim()
  if (!trimmed) return 'idle'
  if (/^\d+$/.test(trimmed)) return 'bp'
  return 'sequence'
}

function Toolbar({
  queryValue,
  queryMode,
  searchMatchCount,
  searchMatchIndex,
  onQueryChange,
  onQuerySubmit,
  onSearchPrev,
  onSearchNext,
  onMidpoint,
}: {
  queryValue: string
  queryMode: QueryMode
  searchMatchCount: number
  searchMatchIndex: number
  onQueryChange: (value: string) => void
  onQuerySubmit: () => void
  onSearchPrev: () => void
  onSearchNext: () => void
  onMidpoint: () => void
}) {
  const isSequence = queryMode === 'sequence'
  const isBp = queryMode === 'bp'
  return (
    <div className="bg-background/25 flex w-full items-center gap-2 rounded-sm px-1 py-0.5">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <span className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
          Go to
        </span>
        <div className="bg-background flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md border px-1.5">
          <input
            type="text"
            inputMode={isBp ? 'numeric' : 'text'}
            value={queryValue}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (isSequence && event.shiftKey) onSearchPrev()
                else onQuerySubmit()
              }
            }}
            className={cn(
              'min-w-0 flex-1 bg-transparent font-mono text-[11px] outline-none',
              isSequence && 'uppercase',
            )}
            placeholder="bp number or ACGT…"
            aria-label="Jump to bp or search sequence"
          />
          {isSequence && (
            <>
              <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                {searchMatchCount === 0
                  ? '0/0'
                  : `${searchMatchIndex + 1}/${searchMatchCount}`}
              </span>
              <button
                type="button"
                onClick={onSearchPrev}
                disabled={searchMatchCount === 0}
                title="Previous match (Shift+Enter)"
                className="text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded disabled:opacity-30"
              >
                <ChevronLeft className="size-3" />
              </button>
              <button
                type="button"
                onClick={onSearchNext}
                disabled={searchMatchCount === 0}
                title="Next match (Enter)"
                className="text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded disabled:opacity-30"
              >
                <ChevronRight className="size-3" />
              </button>
            </>
          )}
          {isBp && (
            <span className="text-muted-foreground font-mono text-[10px] tracking-[0.04em] uppercase">
              bp
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onMidpoint}
        title="Snap caret to midpoint (m)"
        className="text-muted-foreground hover:text-foreground hover:bg-muted/60 bg-background/80 inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors"
      >
        <AlignCenter className="size-3" />
        Midpoint
      </button>
    </div>
  )
}

function SiteNav({
  label,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  label: ReactNode
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="text-muted-foreground inline-flex items-center gap-1 font-mono text-[11px] font-normal tabular-nums">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        title="Previous WGGW site ([)"
        aria-label="Previous WGGW site"
        className="hover:text-foreground hover:bg-muted/60 inline-flex size-5 items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <span className="px-0.5">{label}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        title="Next WGGW site (])"
        aria-label="Next WGGW site"
        className="hover:text-foreground hover:bg-muted/60 inline-flex size-5 items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
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
  activeSearchMatch,
  cursorPosition,
  stripRef,
  onSelectSite,
}: {
  ctx: SequenceContext
  sites: WggwSiteCandidate[]
  selectedSite: WggwSiteCandidate | null
  currentRewrite: WggwRecodingOption | null
  activeSearchMatch: { start: number; length: number } | null
  cursorPosition: number
  stripRef: React.RefObject<HTMLDivElement | null>
  onSelectSite: (site: WggwSiteCandidate) => void
}) {
  const siteByMotifStart = useMemo(() => {
    const map = new Map<number, WggwSiteCandidate>()
    for (const site of sites) map.set(site.motifStart, site)
    return map
  }, [sites])

  const siteCoverByBase = useMemo(() => {
    const map = new Map<number, WggwSiteCandidate>()
    for (const site of sites) {
      for (let k = 0; k < 4; k++) {
        const pos = site.motifStart + k
        const existing = map.get(pos)
        // Selected site wins; otherwise first one stays.
        if (!existing || selectedSite?.position === site.position) {
          map.set(pos, site)
        }
      }
    }
    return map
  }, [sites, selectedSite?.position])

  const changedBases = useMemo(() => {
    const s = new Set<number>()
    if (!selectedSite || !currentRewrite) return s
    for (let i = 0; i < selectedSite.originalHexamer.length; i++) {
      if (selectedSite.originalHexamer[i] !== currentRewrite.newHexamer[i]) {
        s.add(selectedSite.hexamerStart + i)
      }
    }
    return s
  }, [currentRewrite, selectedSite])

  const searchMatchBases = useMemo(() => {
    const s = new Set<number>()
    if (!activeSearchMatch) return s
    for (let i = 0; i < activeSearchMatch.length; i++) {
      s.add(activeSearchMatch.start + i)
    }
    return s
  }, [activeSearchMatch])

  const seqLen = ctx.end - ctx.start + 1
  useLayoutEffect(() => {
    const scroller = stripRef.current
    if (!scroller || seqLen <= 0) return
    const center = () => {
      const targetCenter =
        ((cursorPosition - ctx.start + 0.5) / seqLen) * scroller.scrollWidth
      scroller.scrollLeft = targetCenter - scroller.clientWidth / 2
    }
    center()
    const ro = new ResizeObserver(center)
    ro.observe(scroller)
    return () => ro.disconnect()
  }, [stripRef, cursorPosition, ctx.start, seqLen])

  return (
    <div
      ref={stripRef}
      role="group"
      aria-label="Sequence context around WGGW split site"
      className="bg-muted/40 overflow-x-auto rounded-lg border px-2 py-2 font-mono text-[11px] leading-none sm:py-3"
    >
      <div className="flex items-stretch">
        {ctx.codons.map((codon, codonIdx) => (
          <CodonCard
            key={codon.idx}
            codon={codon}
            site={siteByMotifStart.get(codon.start) ?? null}
            siteCoverByBase={siteCoverByBase}
            selectedSitePosition={selectedSite?.position ?? null}
            changedBases={changedBases}
            searchMatchBases={searchMatchBases}
            cursorPosition={cursorPosition}
            isLast={codonIdx === ctx.codons.length - 1}
            onSelectSite={onSelectSite}
          />
        ))}
      </div>
    </div>
  )
}

function CodonCard({
  codon,
  site,
  siteCoverByBase,
  selectedSitePosition,
  changedBases,
  searchMatchBases,
  cursorPosition,
  isLast,
  onSelectSite,
}: {
  codon: SequenceContext['codons'][number]
  site: WggwSiteCandidate | null
  siteCoverByBase: Map<number, WggwSiteCandidate>
  selectedSitePosition: number | null
  changedBases: Set<number>
  searchMatchBases: Set<number>
  cursorPosition: number
  isLast: boolean
  onSelectSite: (site: WggwSiteCandidate) => void
}) {
  const roleStyles = roleStylesFor(codon.role)
  const siteIsSelected = site && selectedSitePosition === site.position

  return (
    <div
      className={cn(
        'flex w-[42px] shrink-0 flex-col items-stretch text-center',
        !isLast && 'border-border/60 border-r',
      )}
    >
      <div className="text-muted-foreground/75 text-[9px] leading-3 tabular-nums">
        {codon.start.toLocaleString()}
      </div>
      <div className="flex h-3 items-center justify-center">
        {site ? (
          <button
            type="button"
            onClick={() => onSelectSite(site)}
            aria-pressed={!!siteIsSelected}
            title={`WGGW ${site.motif} · bp ${site.position.toLocaleString()} · ${site.baseChanges} bp change${site.baseChanges === 1 ? '' : 's'}`}
            aria-label={`Select WGGW site at bp ${site.position}`}
            className="flex h-full w-full items-center justify-center"
          >
            <span
              className={cn(
                'rounded-full transition-all',
                siteIsSelected
                  ? 'bg-primary h-3 w-2'
                  : cn(costToneFor(site.baseChanges).tickBg, 'h-2 w-2'),
              )}
            />
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          'text-[10px] leading-4 tabular-nums',
          roleStyles.aa,
          siteIsSelected && 'text-primary font-semibold',
        )}
        title={`Codon ${codon.idx + 1}: ${codon.codon}`}
      >
        {codon.aa ?? '·'}
      </div>
      <div className="flex">
        {[0, 1, 2].map((bi) => {
          const pos = codon.start + bi
          const base = codon.codon[bi] ?? ''
          const coverSite = siteCoverByBase.get(pos)
          const inSelectedMotif =
            coverSite && coverSite.position === selectedSitePosition
          const inOtherSite = coverSite && !inSelectedMotif
          const isMotifStart = coverSite && coverSite.motifStart === pos
          const isMotifEnd = coverSite && coverSite.motifStart + 3 === pos
          const isCutBase = pos === cursorPosition
          const isChanged = changedBases.has(pos)
          const inSearchMatch = searchMatchBases.has(pos)
          return (
            <button
              key={pos}
              type="button"
              onClick={coverSite ? () => onSelectSite(coverSite) : undefined}
              disabled={!coverSite}
              aria-pressed={coverSite ? !!inSelectedMotif : undefined}
              title={`bp ${pos.toLocaleString()}${coverSite ? ` · WGGW ${coverSite.motif}` : ''}`}
              className={cn(
                'relative flex h-5 w-[14px] items-center justify-center text-sm font-semibold tabular-nums transition-colors',
                roleStyles.base,
                inOtherSite &&
                  'bg-marker/15 text-foreground hover:bg-marker/25 cursor-pointer',
                inSelectedMotif &&
                  'bg-primary/15 text-primary hover:bg-primary/20 cursor-pointer',
                isMotifStart && 'rounded-l-sm',
                isMotifEnd && 'rounded-r-sm',
                isChanged && 'text-primary',
                inSearchMatch &&
                  'ring-foreground/60 z-10 rounded-sm ring-1 ring-inset',
              )}
            >
              {base}
              {isCutBase && (
                <span
                  className="bg-foreground absolute top-0 bottom-0 -left-px w-px"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Inspector({
  sequence,
  selectedSite,
  selectedSiteIndex,
  totalSites,
  currentRewrite,
  selectedRewriteIndex,
  canPrevSite,
  canNextSite,
  onPrevSite,
  onNextSite,
  onSelectRewrite,
}: {
  sequence: string
  selectedSite: WggwSiteCandidate | null
  selectedSiteIndex: number
  totalSites: number
  currentRewrite: WggwRecodingOption | null
  selectedRewriteIndex: number
  canPrevSite: boolean
  canNextSite: boolean
  onPrevSite: () => void
  onNextSite: () => void
  onSelectRewrite: (index: number) => void
}) {
  if (!selectedSite || !currentRewrite) {
    return (
      <div className="bg-muted/30 flex min-h-[280px] flex-col gap-3 rounded-lg border p-4 text-xs">
        <div className="text-foreground flex items-center justify-between gap-2 text-sm font-semibold">
          <span>Pick a WGGW site</span>
          <SiteNav
            label={`${totalSites} site${totalSites === 1 ? '' : 's'}`}
            canPrev={canPrevSite}
            canNext={canNextSite}
            onPrev={onPrevSite}
            onNext={onNextSite}
          />
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

  const siteCostTone = costToneFor(selectedSite.baseChanges)

  return (
    <div className="bg-muted/30 flex min-h-[280px] flex-col gap-4 rounded-lg border p-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="text-foreground flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-sm tabular-nums">
          <span className="font-semibold">
            bp {selectedSite.position.toLocaleString()}
          </span>
          <span className="text-muted-foreground/80">·</span>
          <span className={cn('font-semibold', siteCostTone.text)}>
            {selectedSite.baseChanges === 0
              ? 'Native'
              : `${selectedSite.baseChanges} bp change${selectedSite.baseChanges === 1 ? '' : 's'}`}
          </span>
        </div>
        <SiteNav
          label={
            <>
              Site{' '}
              <span className="text-foreground font-medium">
                {selectedSiteIndex >= 0 ? selectedSiteIndex + 1 : 0}
              </span>
              <span className="text-muted-foreground/70">/{totalSites}</span>
            </>
          }
          canPrev={canPrevSite}
          canNext={canNextSite}
          onPrev={onPrevSite}
          onNext={onNextSite}
        />
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
            Synonymous rewrites
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
            {selectedSite.rewriteOptions.map((option, index) => {
              const active = index === selectedRewriteIndex
              const optionTone = costToneFor(option.baseChanges)
              return (
                <button
                  type="button"
                  key={`${option.newHexamer}-${index}`}
                  onClick={() => onSelectRewrite(index)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[12px] transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:border-primary/30 hover:bg-background/60',
                  )}
                >
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
                  <span
                    className={cn(
                      'rounded border px-1 py-px text-[9px] font-medium tracking-[0.04em] uppercase',
                      optionTone.badgeBorder,
                      optionTone.badgeBg,
                      optionTone.text,
                    )}
                  >
                    {option.baseChanges === 0
                      ? 'Native'
                      : `${option.baseChanges} bp`}
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
          <div className="bg-background/80 rounded-md border px-3 py-2.5">
            <SequenceContextTable
              rows={[
                {
                  label: 'AA',
                  ...buildAminoAcidGuide(
                    sequence,
                    originalSplitContext.windowStart,
                    originalSplitContext.windowEnd,
                    selectedSite.position,
                  ),
                },
                {
                  label: 'Original sequence',
                  text: originalSplitContext.displayText,
                  boundaryIndexes: originalSplitContext.boundaryIndexes,
                  editedIndexes: originalSplitContext.displayEditedIndexes,
                },
                {
                  label: 'Designed sequence',
                  text: designedSplitContext.displayText,
                  boundaryIndexes: designedSplitContext.boundaryIndexes,
                  editedIndexes: designedSplitContext.displayEditedIndexes,
                },
                {
                  label: 'Motif',
                  ...buildMotifGuide(
                    designedSplitContext.displayText,
                    designedSplitContext.boundaryIndexes,
                  ),
                  hideBoundaries: true,
                },
              ]}
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

interface SequenceRow {
  label: string
  text: string
  boundaryIndexes: number[]
  editedIndexes?: number[]
  hideBoundaries?: boolean
}

function SequenceContextTable({ rows }: { rows: SequenceRow[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const center = () => {
      const target = scroller.querySelector<HTMLElement>('[data-focus="true"]')
      if (!target) return
      const sr = scroller.getBoundingClientRect()
      const tr = target.getBoundingClientRect()
      scroller.scrollLeft += tr.left + tr.width / 2 - (sr.left + sr.width / 2)
    }
    center()
    const ro = new ResizeObserver(center)
    ro.observe(scroller)
    return () => ro.disconnect()
  }, [rows])

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 font-mono text-[14px] leading-[1.2]">
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="text-muted-foreground flex h-[18px] items-center text-[10px] font-medium tracking-[0.08em] whitespace-nowrap uppercase"
          >
            {row.label}
          </div>
        ))}
      </div>
      <div ref={scrollerRef} className="overflow-x-auto">
        <div className="flex w-max flex-col gap-1">
          {rows.map((row, rowIdx) => (
            <SequenceRowText
              key={row.label}
              row={row}
              isFocusRow={rowIdx === 0}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SequenceRowText({
  row,
  isFocusRow,
}: {
  row: SequenceRow
  isFocusRow: boolean
}) {
  const editedSet = new Set(row.editedIndexes ?? [])
  const boundarySet = new Set(row.boundaryIndexes)
  const focusIndex = row.text.indexOf('|')

  return (
    <div className="flex h-[18px] items-stretch whitespace-pre">
      {[...row.text].map((char, index) => (
        <Fragment key={`${char}-${index}`}>
          <span
            data-focus={isFocusRow && index === focusIndex ? 'true' : undefined}
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
                  row.hideBoundaries ? 'bg-transparent' : 'bg-border/80',
                )}
              />
            </span>
          )}
        </Fragment>
      ))}
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

function splitPositionToPercent(position: number, sequenceLength: number) {
  if (sequenceLength <= 0) return 0
  return (position / sequenceLength) * 100
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

interface CostTone {
  tickBg: string
  text: string
  badgeBg: string
  badgeBorder: string
}

function costToneFor(baseChanges: number): CostTone {
  if (baseChanges === 0) {
    return {
      tickBg: 'bg-success',
      text: 'text-success-soft',
      badgeBg: 'bg-success/10',
      badgeBorder: 'border-success/25',
    }
  }
  if (baseChanges === 1) {
    return {
      tickBg: 'bg-marker',
      text: 'text-foreground',
      badgeBg: 'bg-muted/40',
      badgeBorder: 'border-border/60',
    }
  }
  return {
    tickBg: 'bg-danger/70',
    text: 'text-danger-soft',
    badgeBg: 'bg-danger/10',
    badgeBorder: 'border-danger/25',
  }
}

function ShortcutHint({
  active,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onMidpoint,
}: {
  active: boolean
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  onMidpoint: () => void
}) {
  return (
    <div
      className={cn(
        'text-muted-foreground/70 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] transition-opacity',
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!active}
    >
      <ShortcutHintButton
        onClick={onPrev}
        disabled={!canPrev}
        title="Previous WGGW site"
      >
        <Kbd>[</Kbd>
        <span>prev</span>
      </ShortcutHintButton>
      <ShortcutHintButton
        onClick={onNext}
        disabled={!canNext}
        title="Next WGGW site"
      >
        <Kbd>]</Kbd>
        <span>next</span>
      </ShortcutHintButton>
      <ShortcutHintButton onClick={onMidpoint} title="Snap caret to midpoint">
        <Kbd>m</Kbd>
        <span>midpoint</span>
      </ShortcutHintButton>
      <span className="flex items-center gap-1 px-1">
        <Kbd>↵</Kbd>
        <span>find / jump</span>
      </span>
    </div>
  )
}

function ShortcutHintButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="hover:text-foreground hover:bg-muted/60 -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}

type CodonRole = 'start' | 'stop' | 'internal-stop' | 'split' | 'context'

interface SequenceContext {
  start: number
  end: number
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
    role: CodonRole
  }[]
}

function buildSequenceContext(sequence: string): SequenceContext {
  const upper = sequence.toUpperCase().replace(/U/g, 'T')
  const seqLen = upper.length
  const start = 1
  const end = seqLen
  const totalCodons = Math.ceil(seqLen / 3)
  const lastCodonIdx = totalCodons - 1
  const bases: SequenceContext['bases'] = []

  for (let pos = 1; pos <= seqLen; pos++) {
    const codonIdx = Math.floor((pos - 1) / 3)
    const codonStart = codonIdx * 3 + 1
    const codon = upper.slice(codonStart - 1, codonStart + 2)
    const aa = codon.length === 3 ? translateCodon(codon) : null
    let role: CodonRole = 'context'
    if (codonStart === 1) role = 'start'
    else if (codonIdx === lastCodonIdx && aa === '*') role = 'stop'
    else if (aa === '*') role = 'internal-stop'
    bases.push({ base: upper[pos - 1] ?? '.', position: pos, role })
  }

  const codons: SequenceContext['codons'] = []
  for (let idx = 0; idx < totalCodons; idx++) {
    const codonStart = idx * 3 + 1
    const codonEnd = Math.min(codonStart + 2, seqLen)
    const codon = upper.slice(codonStart - 1, codonEnd)
    const aa = codon.length === 3 ? translateCodon(codon) : null
    let role: CodonRole = 'context'
    if (codonStart === 1) role = 'start'
    else if (idx === lastCodonIdx && aa === '*') role = 'stop'
    else if (aa === '*') role = 'internal-stop'
    codons.push({
      codon,
      aa,
      idx,
      start: codonStart,
      end: codonEnd,
      role,
    })
  }

  return { start, end, bases, codons }
}

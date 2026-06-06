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
  type WggwRecodingOption,
} from '@/lib/bio/sequence-utils'
import { translateCodon } from '@/lib/bio/genetic-code'
import { ChevronLeft, ChevronRight, AlignCenter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SelectedWggwSite } from '../types/form-schema'
import {
  AAV_MAX_BP,
  MIN_SEQUENCE_LENGTH,
  RECENTLY_ASSIGNED_DURATION_MS,
  STRIP_SMOOTH_SCROLL_THRESHOLD_BP,
  TICK_CLICK_THRESHOLD_PX,
} from './splice-slider/constants'
import { costToneFor, spliceTone } from './splice-slider/tones'
import type {
  CodonRole,
  SequenceContext,
  WggwSiteCandidate,
} from './splice-slider/types'
import {
  applyRewriteToSequence,
  buildAminoAcidGuide,
  buildMotifGuide,
  buildSegments,
  buildSequenceContext,
  buildSplitContext,
  findSequenceMatches,
  formatMotifSplit,
  getEditedPositions,
  groupWggwSites,
  nearestSiteIndex,
  roleStylesFor,
  scoreRewriteOption,
  splitPositionToPercent,
} from './splice-slider/sequence-helpers'

interface Props {
  sequence: string
  positions: number[]
  // Host species for the codon-preference score on rewrite chips. 'none'
  // hides the score (no host picked = the score is meaningless).
  species: 'none' | 'human' | 'mouse'
  onPositionsChange: (positions: number[]) => void
  onSelectionChange: (sites: (SelectedWggwSite | null)[]) => void
}

export function SpliceSliderContext({
  sequence,
  positions: inputPositions,
  species,
  onPositionsChange,
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
    if (seqLen < MIN_SEQUENCE_LENGTH) return []
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
  const positions = useMemo(() => {
    const first = inputPositions[0] ?? midpoint
    return [Math.max(1, Math.min(seqLen - 1, first))]
  }, [inputPositions, midpoint, seqLen])

  useEffect(() => {
    if (inputPositions.length !== 1 || inputPositions[0] !== positions[0]) {
      onPositionsChange(positions)
    }
  }, [inputPositions, onPositionsChange, positions])

  const spliceCount = Math.max(1, positions.length)
  const [activeSpliceIndex, setActiveSpliceIndex] = useState(0)
  const clampedActiveIndex = Math.min(activeSpliceIndex, spliceCount - 1)
  const activePosition = positions[clampedActiveIndex] ?? midpoint

  // Raw mutable state. Reads go through `activeSitePositions` /
  // `rewriteSelections` below, which normalize the array length to
  // `spliceCount` during render — no separate sync effect needed.
  const [activeSitePositionsRaw, setActiveSitePositions] = useState<
    (number | null)[]
  >(() => positions.map(() => null))
  const activeSitePositions = useMemo(() => {
    if (activeSitePositionsRaw.length === spliceCount) {
      return activeSitePositionsRaw
    }
    const next = activeSitePositionsRaw.slice(0, spliceCount)
    while (next.length < spliceCount) next.push(null)
    return next
  }, [activeSitePositionsRaw, spliceCount])

  const selectedSites = useMemo(
    () =>
      activeSitePositions.map(
        (pos) => wggwSites.find((s) => s.position === pos) ?? null,
      ),
    [activeSitePositions, wggwSites],
  )
  const selectedSiteIndices = selectedSites.map((site) =>
    site ? wggwSites.findIndex((s) => s.position === site.position) : -1,
  )

  const [rewriteSelectionsRaw, setRewriteSelections] = useState<
    { position: number | null; index: number }[]
  >(() => positions.map(() => ({ position: null, index: 0 })))
  const rewriteSelections = useMemo(() => {
    if (rewriteSelectionsRaw.length === spliceCount) {
      return rewriteSelectionsRaw
    }
    const next = rewriteSelectionsRaw.slice(0, spliceCount)
    while (next.length < spliceCount) next.push({ position: null, index: 0 })
    return next
  }, [rewriteSelectionsRaw, spliceCount])

  const currentRewrites = selectedSites.map((site, i) => {
    if (!site) return null
    const sel = rewriteSelections[i]
    const idx = sel?.position === site.position ? sel.index : 0
    return (
      site.rewriteOptions[Math.min(idx, site.rewriteOptions.length - 1)] ?? null
    )
  })

  const frameContext = useMemo(() => buildSequenceContext(sequence), [sequence])

  const setPositionAt = useCallback(
    (_idx: number, value: number) => {
      const v = Math.max(1, Math.min(seqLen - 1, value))
      onPositionsChange([v])
    },
    [onPositionsChange, seqLen],
  )

  // Brief pulse on a splice's readout right after a tick is assigned to
  // it — closes the "silent magic" loop for nearest-caret routing.
  const [recentlyAssignedSplice, setRecentlyAssignedSplice] = useState<
    number | null
  >(null)
  // Hover handled imperatively via a data attribute (pointer-move on the
  // strip would otherwise rerender the component on every frame). The
  // hovered tick is identified by [data-site-pos]; Tailwind's data
  // variants on the tick spans render the hover decoration without React.
  const wggwStripRef = useRef<HTMLDivElement>(null)
  const hoveredTickRef = useRef<HTMLElement | null>(null)
  const setHoveredTick = useCallback((sitePosition: number | null) => {
    const strip = wggwStripRef.current
    if (!strip) return
    const next = sitePosition
      ? strip.querySelector<HTMLElement>(`[data-site-pos="${sitePosition}"]`)
      : null
    if (hoveredTickRef.current === next) return
    if (hoveredTickRef.current) {
      delete hoveredTickRef.current.dataset.tickHovered
    }
    if (next) {
      next.dataset.tickHovered = 'true'
    }
    hoveredTickRef.current = next
  }, [])

  // When a tick is clicked without an explicit splice index, assign it to
  // the splice whose caret is nearest the chosen site. This matches the
  // user's spatial intuition (clicking a tick on the right side of the
  // sequence "obviously" wants the right-side splice).
  const handleSelectSite = useCallback(
    (site: WggwSiteCandidate, spliceIdx?: number) => {
      let idx = spliceIdx ?? clampedActiveIndex
      setActiveSitePositions((prev) => {
        const next = [...prev]
        next[idx] = site.position
        return next
      })
      setActiveSpliceIndex(idx)
      setPositionAt(idx, site.position)
      setRecentlyAssignedSplice(idx)
      window.setTimeout(() => {
        setRecentlyAssignedSplice((prev) => (prev === idx ? null : prev))
      }, RECENTLY_ASSIGNED_DURATION_MS)
    },
    [clampedActiveIndex, setPositionAt],
  )

  const jumpToSibling = useCallback(
    (dir: -1 | 1) => {
      if (wggwSites.length === 0) return
      const idx = clampedActiveIndex
      const currentSiteIndex = selectedSiteIndices[idx] ?? -1
      if (currentSiteIndex === -1) {
        const nextIdx = nearestSiteIndex(wggwSites, activePosition)
        if (nextIdx !== -1) handleSelectSite(wggwSites[nextIdx], idx)
        return
      }
      const target = currentSiteIndex + dir
      if (target < 0 || target >= wggwSites.length) return
      handleSelectSite(wggwSites[target], idx)
    },
    [
      activePosition,
      clampedActiveIndex,
      handleSelectSite,
      selectedSiteIndices,
      wggwSites,
    ],
  )

  // Emit selected sites + current rewrites whenever they change. Use
  // primitive composite keys so the effect deps are cheap to compare and
  // skip when nothing semantic has changed.
  const sitePositionsKey = selectedSites.map((s) => s?.position ?? '').join('|')
  const rewriteHexamerKey = currentRewrites
    .map((r) => r?.newHexamer ?? '')
    .join('|')
  useEffect(() => {
    onSelectionChange(
      selectedSites.map((site, i) => {
        const rewrite = currentRewrites[i]
        if (!site || !rewrite) return null
        return {
          position: site.position,
          motifStart: site.motifStart,
          motif: site.motif,
          hexamerStart: site.hexamerStart,
          originalCodons: site.originalCodons,
          newCodons: rewrite.newCodons,
          newHexamer: rewrite.newHexamer,
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSelectionChange, sitePositionsKey, rewriteHexamerKey])

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
        setPositionAt(clampedActiveIndex, midpoint)
        return
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
  }, [
    clampedActiveIndex,
    jumpToSibling,
    midpoint,
    positions.length,
    setPositionAt,
    shortcutsActive,
  ])

  const positionFromPointer = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return activePosition
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

  // Begin a pointer-driven drag of a specific splice's caret. Used by both
  // the slider track (where dragIdx is the nearest caret to the click)
  // and the bp-readout buttons above the track (which drag their own
  // caret). The drag uses pointer-delta from the press point so the caret
  // follows the cursor smoothly even when the readout doesn't visually
  // sit exactly on the caret line (e.g. clamped near the edges).
  const startDrag = (
    spliceIdx: number,
    e: React.PointerEvent<HTMLElement>,
    snapToInitial: boolean,
  ) => {
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    setActiveSpliceIndex(spliceIdx)
    const startClientX = e.clientX
    const startPos = positions[spliceIdx] ?? midpoint
    if (snapToInitial) {
      const initial = positionFromPointer(e.clientX)
      setPositionAt(spliceIdx, initial)
      scrollStripToPosition(initial)
    }
    const track = trackRef.current
    const trackWidth = track?.getBoundingClientRect().width ?? 0
    const handleMove = (ev: PointerEvent) => {
      let next: number
      if (snapToInitial) {
        next = positionFromPointer(ev.clientX)
      } else if (trackWidth > 0) {
        const dx = ev.clientX - startClientX
        const dpos = (dx / trackWidth) * seqLen
        next = Math.max(1, Math.min(seqLen - 1, Math.round(startPos + dpos)))
      } else {
        next = startPos
      }
      setPositionAt(spliceIdx, next)
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

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const initial = positionFromPointer(e.clientX)
    let dragIdx = 0
    let bestDist = Infinity
    positions.forEach((p, i) => {
      const d = Math.abs(p - initial)
      if (d < bestDist) {
        bestDist = d
        dragIdx = i
      }
    })
    e.currentTarget.focus()
    startDrag(dragIdx, e, true)
  }

  const jumpToPosition = (nextPosition: number) => {
    setPositionAt(
      clampedActiveIndex,
      Math.max(1, Math.min(seqLen - 1, nextPosition)),
    )
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

  if (seqLen < MIN_SEQUENCE_LENGTH) return null

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
        onMidpoint={() => setPositionAt(clampedActiveIndex, midpoint)}
      />

      <div className="space-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="relative h-7">
            {positions.map((pos, idx) => {
              const tone = spliceTone(idx)
              const pct = splitPositionToPercent(pos, seqLen)
              const siteIdx = selectedSiteIndices[idx] ?? -1
              const canPrev =
                siteIdx > 0 || (siteIdx === -1 && wggwSites.length > 0)
              const canNext =
                (siteIdx >= 0 && siteIdx < wggwSites.length - 1) ||
                (siteIdx === -1 && wggwSites.length > 0)
              const isActive = idx === clampedActiveIndex
              return (
                <div
                  key={`readout-${idx}`}
                  className="absolute top-0 -translate-x-1/2"
                  style={{ left: `${pct}%` }}
                >
                  <div className="flex items-center gap-1">
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSpliceIndex(idx)
                          jumpToSibling(-1)
                        }}
                        disabled={!canPrev}
                        title="Previous WGGW site"
                        aria-label="Previous WGGW site"
                        className="text-foreground/55 hover:text-foreground inline-flex size-4 items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronLeft className="size-3" strokeWidth={2.5} />
                      </button>
                    )}
                    <button
                      type="button"
                      onPointerDown={(e) => startDrag(idx, e, false)}
                      title={`Split point at bp ${pos.toLocaleString()} — drag to move`}
                      className={cn(
                        'bg-background inline-flex min-w-max cursor-grab touch-none items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold whitespace-nowrap tabular-nums shadow-sm transition-all active:cursor-grabbing',
                        isActive
                          ? cn('ring-2', tone.caretRing, tone.text)
                          : 'text-muted-foreground/80 opacity-70',
                        recentlyAssignedSplice === idx &&
                          'animate-[pulse_0.6s_ease-out_1]',
                      )}
                    >
                      <span
                        className={cn(
                          'mr-1.5 inline-block size-1.5 rounded-full',
                          tone.caret,
                        )}
                        aria-hidden="true"
                      />
                      {pos.toLocaleString()} bp
                    </button>
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSpliceIndex(idx)
                          jumpToSibling(1)
                        }}
                        disabled={!canNext}
                        title="Next WGGW site"
                        aria-label="Next WGGW site"
                        className="text-foreground/55 hover:text-foreground inline-flex size-4 items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronRight className="size-3" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Splice junction position"
            aria-valuemin={1}
            aria-valuemax={seqLen - 1}
            aria-valuenow={activePosition}
            aria-valuetext={`bp ${activePosition.toLocaleString()} of ${seqLen.toLocaleString()}`}
            onPointerDown={handleTrackPointerDown}
            className="focus-visible:ring-ring bg-background/80 relative h-16 cursor-ew-resize touch-none rounded-lg border select-none focus:outline-none focus-visible:ring-2"
          >
            <div className="absolute inset-x-0 top-0 z-10 flex h-11 overflow-hidden rounded-t-lg">
              {buildSegments(positions, seqLen).map((seg, i, arr) => {
                const isFirst = i === 0
                const segTone = isFirst
                  ? spliceTone(0)
                  : { fillSeg: 'bg-muted/50', text: 'text-muted-foreground' }
                const widthPct = ((seg.end - seg.start) / seqLen) * 100
                const fragmentBp = seg.end - seg.start
                const overAAV = fragmentBp > AAV_MAX_BP
                return (
                  <div
                    key={`seg-${i}`}
                    className={cn(
                      'flex min-w-0 items-center justify-center',
                      overAAV ? 'bg-danger/15' : segTone.fillSeg,
                    )}
                    style={{ width: `${widthPct}%` }}
                  >
                    <span
                      className={cn(
                        'pointer-events-none truncate px-4 text-sm font-semibold tracking-[0.01em] tabular-nums',
                        overAAV ? 'text-danger-soft' : segTone.text,
                      )}
                      title={
                        overAAV
                          ? `${fragmentBp.toLocaleString()} bp exceeds the ~${AAV_MAX_BP.toLocaleString()} bp AAV packaging limit`
                          : `${fragmentBp.toLocaleString()} bp · within the AAV packaging limit`
                      }
                    >
                      {seg.label && `${seg.label} · `}
                      {fragmentBp.toLocaleString()} bp
                    </span>
                  </div>
                )
              })}
            </div>
            <div
              ref={wggwStripRef}
              role="presentation"
              className="bg-background/70 absolute inset-x-0 bottom-0 h-5 cursor-pointer overflow-hidden rounded-b-lg border-t"
              // Parent-routed tick selection: compute clicked bp from
              // clientX and pick the nearest WGGW site within a small
              // pixel threshold. Avoids the prior bug where overlapping
              // tick hit-areas biased clicks toward the right-most tick.
              onPointerDown={(e) => {
                e.stopPropagation()
                const track = trackRef.current
                if (!track || wggwSites.length === 0) return
                const rect = track.getBoundingClientRect()
                if (rect.width <= 0) return
                const x = Math.max(
                  0,
                  Math.min(e.clientX - rect.left, rect.width),
                )
                const clickBp = (x / rect.width) * seqLen
                let nearest: WggwSiteCandidate | null = null
                let bestDist = Infinity
                for (const site of wggwSites) {
                  const d = Math.abs(site.position - clickBp)
                  if (d < bestDist) {
                    bestDist = d
                    nearest = site
                  }
                }
                const pixelDist = (bestDist / seqLen) * rect.width
                if (nearest && pixelDist <= TICK_CLICK_THRESHOLD_PX) {
                  handleSelectSite(nearest)
                }
              }}
              onPointerMove={(e) => {
                const track = trackRef.current
                if (!track || wggwSites.length === 0) return
                const rect = track.getBoundingClientRect()
                if (rect.width <= 0) return
                const x = Math.max(
                  0,
                  Math.min(e.clientX - rect.left, rect.width),
                )
                const hoverBp = (x / rect.width) * seqLen
                let nearest: WggwSiteCandidate | null = null
                let bestDist = Infinity
                for (const site of wggwSites) {
                  const d = Math.abs(site.position - hoverBp)
                  if (d < bestDist) {
                    bestDist = d
                    nearest = site
                  }
                }
                const pixelDist = (bestDist / seqLen) * rect.width
                setHoveredTick(
                  nearest && pixelDist <= TICK_CLICK_THRESHOLD_PX
                    ? nearest.position
                    : null,
                )
              }}
              onPointerLeave={() => setHoveredTick(null)}
            >
              {stripWindow && (
                <div
                  className="bg-foreground/10 pointer-events-none absolute inset-y-0"
                  style={{
                    left: `${((stripWindow.start - 1) / seqLen) * 100}%`,
                    width: `${((stripWindow.end - stripWindow.start + 1) / seqLen) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              )}
              {wggwSites.map((site, i) => {
                const x = splitPositionToPercent(site.position, seqLen)
                const selectedAt = activeSitePositions.findIndex(
                  (p) => p === site.position,
                )
                const isSelected = selectedAt !== -1
                const costTone = costToneFor(site.baseChanges)
                return (
                  <span
                    key={`${site.position}-${i}`}
                    data-site-pos={site.position}
                    aria-hidden="true"
                    title={`WGGW ${site.motif} · bp ${site.position.toLocaleString()} · ${site.baseChanges} bp change${site.baseChanges === 1 ? '' : 's'}`}
                    className={cn(
                      'pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all',
                      isSelected
                        ? cn(spliceTone(selectedAt).tickBg, 'h-4 w-1.5')
                        : cn(
                            costTone.tickBg,
                            'h-3 w-1',
                            'data-[tick-hovered=true]:ring-foreground/30 data-[tick-hovered=true]:z-10 data-[tick-hovered=true]:h-4 data-[tick-hovered=true]:w-1.5 data-[tick-hovered=true]:ring-1',
                          ),
                    )}
                    style={{ left: `${x}%` }}
                  />
                )
              })}
            </div>
            {positions.map((pos, idx) => {
              const pct = splitPositionToPercent(pos, seqLen)
              const tone = spliceTone(idx)
              return (
                <div
                  key={`cut-${idx}`}
                  className="pointer-events-none absolute inset-y-0 left-0 z-0 w-0 -translate-x-1/2"
                  style={{ left: `${pct}%` }}
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      'absolute inset-y-0 left-1/2 z-0 -translate-x-1/2 border-l-2',
                      tone.border,
                    )}
                  />
                </div>
              )
            })}
          </div>

          <LocalSequenceView
            ctx={frameContext}
            sites={wggwSites}
            selectedSites={selectedSites}
            currentRewrites={currentRewrites}
            activeSearchMatch={activeSearchMatch}
            cursorPositions={positions}
            activeSpliceIndex={clampedActiveIndex}
            stripRef={frameStripRef}
            onSelectSite={handleSelectSite}
          />
          <div className="flex justify-end px-1">
            <ShortcutHint active={shortcutsActive} />
          </div>
        </div>

        <div className="grid min-w-0 gap-3">
          {positions.map((_pos, idx) => (
            <Inspector
              key={`inspector-${idx}`}
              sequence={sequence}
              selectedSite={selectedSites[idx]}
              selectedSiteIndex={selectedSiteIndices[idx] ?? -1}
              totalSites={wggwSites.length}
              species={species}
              currentRewrite={currentRewrites[idx]}
              selectedRewriteIndex={(() => {
                const sel = rewriteSelections[idx]
                const site = selectedSites[idx]
                if (!sel || !site) return 0
                return sel.position === site.position ? sel.index : 0
              })()}
              canPrevSite={
                (selectedSiteIndices[idx] ?? -1) > 0 ||
                ((selectedSiteIndices[idx] ?? -1) === -1 &&
                  wggwSites.length > 0)
              }
              canNextSite={
                ((selectedSiteIndices[idx] ?? -1) >= 0 &&
                  (selectedSiteIndices[idx] ?? -1) < wggwSites.length - 1) ||
                ((selectedSiteIndices[idx] ?? -1) === -1 &&
                  wggwSites.length > 0)
              }
              onPrevSite={() => {
                setActiveSpliceIndex(idx)
                jumpToSibling(-1)
              }}
              onNextSite={() => {
                setActiveSpliceIndex(idx)
                jumpToSibling(1)
              }}
              onSelectRewrite={(index) => {
                const site = selectedSites[idx]
                setRewriteSelections((prev) => {
                  const next = [...prev]
                  next[idx] = { position: site?.position ?? null, index }
                  return next
                })
              }}
            />
          ))}
        </div>
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onMidpoint}
        title="Snap caret to midpoint (m)"
        className="text-muted-foreground hover:text-foreground"
      >
        <AlignCenter />
        Midpoint
      </Button>
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
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onPrev}
        disabled={!canPrev}
        title="Previous WGGW site ([)"
        aria-label="Previous WGGW site"
        className="hover:text-foreground size-5 [&_svg:not([class*='size-'])]:size-3.5"
      >
        <ChevronLeft />
      </Button>
      <span className="px-0.5">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={!canNext}
        title="Next WGGW site (])"
        aria-label="Next WGGW site"
        className="hover:text-foreground size-5 [&_svg:not([class*='size-'])]:size-3.5"
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

function LocalSequenceView({
  ctx,
  sites,
  selectedSites,
  currentRewrites,
  activeSearchMatch,
  cursorPositions,
  activeSpliceIndex,
  stripRef,
  onSelectSite,
}: {
  ctx: SequenceContext
  sites: WggwSiteCandidate[]
  selectedSites: (WggwSiteCandidate | null)[]
  currentRewrites: (WggwRecodingOption | null)[]
  activeSearchMatch: { start: number; length: number } | null
  cursorPositions: number[]
  activeSpliceIndex: number
  stripRef: React.RefObject<HTMLDivElement | null>
  onSelectSite: (site: WggwSiteCandidate) => void
}) {
  const [hoveredSitePosition, setHoveredSitePosition] = useState<number | null>(
    null,
  )

  // For each base position, which selected splice index (if any) covers it.
  // Selected sites win over unselected; among selected, lower splice index
  // wins (splice 1 takes priority on overlapping bases).
  const selectedCoverByBase = useMemo(() => {
    const map = new Map<
      number,
      { spliceIndex: number; site: WggwSiteCandidate }
    >()
    selectedSites.forEach((site, spliceIndex) => {
      if (!site) return
      for (let k = 0; k < 4; k++) {
        const pos = site.motifStart + k
        if (!map.has(pos)) map.set(pos, { spliceIndex, site })
      }
    })
    return map
  }, [selectedSites])

  // Other (non-selected) sites' base coverage, used for hover affordance.
  const otherSiteCoverByBase = useMemo(() => {
    const map = new Map<number, WggwSiteCandidate>()
    const selectedPositions = new Set(
      selectedSites.filter((s) => s).map((s) => s!.position),
    )
    for (const site of sites) {
      if (selectedPositions.has(site.position)) continue
      for (let k = 0; k < 4; k++) {
        const pos = site.motifStart + k
        if (!map.has(pos)) map.set(pos, site)
      }
    }
    return map
  }, [sites, selectedSites])

  const motifSitesByBase = useMemo(() => {
    const map = new Map<number, WggwSiteCandidate[]>()
    for (const site of sites) {
      for (let k = 0; k < 4; k++) {
        const pos = site.motifStart + k
        const entries = map.get(pos)
        if (entries) entries.push(site)
        else map.set(pos, [site])
      }
    }
    return map
  }, [sites])

  const selectedSiteIndexByPosition = useMemo(() => {
    const map = new Map<number, number>()
    selectedSites.forEach((site, spliceIndex) => {
      if (site) map.set(site.position, spliceIndex)
    })
    return map
  }, [selectedSites])

  const changedBases = useMemo(() => {
    const s = new Map<number, number>() // base position → splice index
    selectedSites.forEach((site, spliceIndex) => {
      const rewrite = currentRewrites[spliceIndex]
      if (!site || !rewrite) return
      for (let i = 0; i < site.originalHexamer.length; i++) {
        if (site.originalHexamer[i] !== rewrite.newHexamer[i]) {
          s.set(site.hexamerStart + i, spliceIndex)
        }
      }
    })
    return s
  }, [currentRewrites, selectedSites])

  const searchMatchBases = useMemo(() => {
    const s = new Set<number>()
    if (!activeSearchMatch) return s
    for (let i = 0; i < activeSearchMatch.length; i++) {
      s.add(activeSearchMatch.start + i)
    }
    return s
  }, [activeSearchMatch])

  const seqLen = ctx.end - ctx.start + 1
  const focusPosition = cursorPositions[activeSpliceIndex] ?? cursorPositions[0]
  // Smooth scroll only on "big jumps" (active-splice switch, midpoint, [/],
  // GoTo). Drag emits per-frame focus updates with small deltas — those
  // stay instant since the slider's pointer handler already imperatively
  // scrolled the strip in the same frame.
  const lastFocusRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    const scroller = stripRef.current
    if (!scroller || seqLen <= 0 || focusPosition == null) return
    const targetCenter =
      ((focusPosition - ctx.start + 0.5) / seqLen) * scroller.scrollWidth
    const left = targetCenter - scroller.clientWidth / 2
    const prev = lastFocusRef.current
    const isBigJump =
      prev !== null &&
      Math.abs(focusPosition - prev) > STRIP_SMOOTH_SCROLL_THRESHOLD_BP
    if (isBigJump) {
      scroller.scrollTo({ left, behavior: 'smooth' })
    } else {
      scroller.scrollLeft = left
    }
    lastFocusRef.current = focusPosition
    const onResize = () => {
      const t =
        ((focusPosition - ctx.start + 0.5) / seqLen) * scroller.scrollWidth
      scroller.scrollLeft = t - scroller.clientWidth / 2
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(scroller)
    return () => ro.disconnect()
  }, [stripRef, focusPosition, ctx.start, seqLen])

  return (
    // Single scroller on the rounded card itself. Asymmetric vertical
    // padding (more bottom than top) keeps the horizontal scrollbar in
    // its own space below the bases — on platforms with overlay
    // scrollbars (macOS) the bar sits over padding rather than the
    // base letters at the bottom of each card.
    <div
      ref={stripRef}
      role="group"
      aria-label="Sequence context around WGGW split site"
      className="bg-muted/40 type-nano overflow-x-auto rounded-lg border px-5 py-1 font-mono leading-none [-ms-overflow-style:none] [scrollbar-width:none] sm:py-2 [&::-webkit-scrollbar]:hidden"
      onPointerLeave={() => setHoveredSitePosition(null)}
    >
      <div className="flex items-stretch">
        {ctx.codons.map((codon, codonIdx) => (
          <CodonCard
            key={codon.idx}
            codon={codon}
            selectedCoverByBase={selectedCoverByBase}
            otherSiteCoverByBase={otherSiteCoverByBase}
            motifSitesByBase={motifSitesByBase}
            selectedSiteIndexByPosition={selectedSiteIndexByPosition}
            changedBases={changedBases}
            searchMatchBases={searchMatchBases}
            hoveredSitePosition={hoveredSitePosition}
            isLast={codonIdx === ctx.codons.length - 1}
            onHoverSite={setHoveredSitePosition}
            onSelectSite={onSelectSite}
          />
        ))}
      </div>
    </div>
  )
}

function CodonCard({
  codon,
  selectedCoverByBase,
  otherSiteCoverByBase,
  motifSitesByBase,
  selectedSiteIndexByPosition,
  changedBases,
  searchMatchBases,
  hoveredSitePosition,
  isLast,
  onHoverSite,
  onSelectSite,
}: {
  codon: SequenceContext['codons'][number]
  selectedCoverByBase: Map<
    number,
    { spliceIndex: number; site: WggwSiteCandidate }
  >
  otherSiteCoverByBase: Map<number, WggwSiteCandidate>
  motifSitesByBase: Map<number, WggwSiteCandidate[]>
  selectedSiteIndexByPosition: Map<number, number>
  changedBases: Map<number, number>
  searchMatchBases: Set<number>
  hoveredSitePosition: number | null
  isLast: boolean
  onHoverSite: (position: number | null) => void
  onSelectSite: (site: WggwSiteCandidate) => void
}) {
  const roleStyles = roleStylesFor(codon.role)

  const cardClasses = cn(
    'relative flex w-12 shrink-0 flex-col items-stretch pt-3 text-center',
  )

  return (
    <div className={cardClasses}>
      {!isLast && (
        <span
          className="border-border/60 pointer-events-none absolute top-3 right-0 bottom-0 border-r"
          aria-hidden="true"
        />
      )}
      <div className="text-muted-foreground/75 pointer-events-none absolute top-0 left-0 z-10 w-max -translate-x-1/2 text-[9px] leading-3 tabular-nums">
        {codon.start.toLocaleString()}
      </div>
      <div
        className={cn('text-[10px] leading-5 tabular-nums', roleStyles.aa)}
        title={`Codon ${codon.idx + 1}: ${codon.codon}`}
      >
        {codon.aa ?? '·'}
      </div>
      <div className="flex">
        {[0, 1, 2].map((bi) => {
          const pos = codon.start + bi
          const base = codon.codon[bi] ?? ''
          const selectedCover = selectedCoverByBase.get(pos)
          const otherCover = !selectedCover
            ? otherSiteCoverByBase.get(pos)
            : undefined
          const motifSites = motifSitesByBase.get(pos) ?? []
          const hoveredCoverSite =
            hoveredSitePosition == null
              ? null
              : (motifSites.find(
                  (site) => site.position === hoveredSitePosition,
                ) ?? null)
          const inSelectedMotif = !!selectedCover
          const inOtherSite = !!otherCover
          const coverSite =
            hoveredCoverSite ?? selectedCover?.site ?? otherCover ?? null
          const isHoveredSite = !!hoveredCoverSite
          const isOverlappingMotifBase = motifSites.length > 1
          const isInteractiveStart = coverSite && coverSite.motifStart === pos
          const changedSpliceIdx = changedBases.get(pos) ?? -1
          const isChanged = changedSpliceIdx !== -1
          const changeTone = isChanged ? spliceTone(changedSpliceIdx) : null
          const inSearchMatch = searchMatchBases.has(pos)
          const selectedTone = selectedCover
            ? spliceTone(selectedCover.spliceIndex)
            : null
          const baseClassName = cn(
            'relative flex h-8 w-4 items-center justify-center text-[15px] font-semibold tabular-nums transition-colors',
            roleStyles.base,
            coverSite &&
              'cursor-pointer border-0 bg-transparent p-0 font-mono leading-none text-foreground focus-visible:z-20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            inOtherSite && 'text-foreground',
            isOverlappingMotifBase && 'text-foreground',
            inSelectedMotif && selectedTone && selectedTone.baseText,
            isHoveredSite && 'z-10 text-foreground',
            isHoveredSite &&
              !inSelectedMotif &&
              isOverlappingMotifBase &&
              'text-foreground',
            changeTone && changeTone.text,
            inSearchMatch &&
              'ring-foreground/60 z-10 rounded-sm ring-1 ring-inset',
          )
          const baseContent = (
            <>
              {motifSites.map((site, layerIndex) => (
                <span
                  key={`${site.position}-${layerIndex}-fill`}
                  className={motifFillClass({
                    site,
                    pos,
                    isOverlappingMotifBase,
                    isHovered: hoveredSitePosition === site.position,
                    selectedSpliceIndex: selectedSiteIndexByPosition.get(
                      site.position,
                    ),
                  })}
                  aria-hidden="true"
                />
              ))}
              {motifSites.map((site, layerIndex) => (
                <span
                  key={`${site.position}-${layerIndex}`}
                  className={motifOutlineClass({
                    site,
                    pos,
                    isOverlappingMotifBase,
                    isHovered: hoveredSitePosition === site.position,
                    selectedSpliceIndex: selectedSiteIndexByPosition.get(
                      site.position,
                    ),
                  })}
                  aria-hidden="true"
                />
              ))}
              <span className="relative z-10">{base}</span>
            </>
          )

          if (coverSite) {
            return (
              <button
                key={pos}
                type="button"
                tabIndex={isInteractiveStart ? 0 : -1}
                title={`bp ${pos.toLocaleString()} · WGGW ${coverSite.motif}`}
                aria-label={`Select WGGW ${coverSite.motif} site at bp ${coverSite.position}`}
                className={baseClassName}
                onClick={() => onSelectSite(coverSite)}
                onFocus={() => onHoverSite(coverSite.position)}
                onBlur={() => onHoverSite(null)}
                onPointerEnter={() => onHoverSite(coverSite.position)}
              >
                {baseContent}
              </button>
            )
          }

          return (
            <span
              key={pos}
              title={`bp ${pos.toLocaleString()}`}
              className={baseClassName}
            >
              {baseContent}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function motifFillClass({
  site,
  pos,
  isOverlappingMotifBase,
  isHovered,
  selectedSpliceIndex,
}: {
  site: WggwSiteCandidate
  pos: number
  isOverlappingMotifBase: boolean
  isHovered: boolean
  selectedSpliceIndex: number | undefined
}) {
  const isSelected = selectedSpliceIndex !== undefined
  const isStart = site.motifStart === pos
  const isEnd = site.motifStart + 3 === pos
  const selectedFill =
    selectedSpliceIndex === 0 ? 'bg-primary/15' : 'bg-marker/15'

  return cn(
    'pointer-events-none absolute inset-0 transition-colors',
    isSelected ? cn('z-[1]', selectedFill) : 'z-0 bg-marker/10',
    isHovered && !isSelected && 'bg-marker/15',
    (!isOverlappingMotifBase || isSelected) && isStart && 'rounded-l-sm',
    (!isOverlappingMotifBase || isSelected) && isEnd && 'rounded-r-sm',
  )
}

function motifOutlineClass({
  site,
  pos,
  isOverlappingMotifBase,
  isHovered,
  selectedSpliceIndex,
}: {
  site: WggwSiteCandidate
  pos: number
  isOverlappingMotifBase: boolean
  isHovered: boolean
  selectedSpliceIndex: number | undefined
}) {
  const isSelected = selectedSpliceIndex !== undefined
  const isStart = site.motifStart === pos
  const isEnd = site.motifStart + 3 === pos
  const selectedBorder =
    selectedSpliceIndex === 0 ? 'border-primary/70' : 'border-marker/70'

  return cn(
    'pointer-events-none absolute inset-0 border-y transition-colors',
    isSelected ? 'z-[5]' : isHovered ? 'z-[4]' : 'z-[3]',
    isSelected
      ? selectedBorder
      : isHovered
        ? 'border-marker/70'
        : 'border-foreground/15',
    isStart && 'border-l',
    isEnd && 'border-r',
    (!isOverlappingMotifBase || isSelected) && isStart && 'rounded-l-sm',
    (!isOverlappingMotifBase || isSelected) && isEnd && 'rounded-r-sm',
  )
}

function Inspector({
  sequence,
  selectedSite,
  selectedSiteIndex,
  totalSites,
  species,
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
  species: 'none' | 'human' | 'mouse'
  currentRewrite: WggwRecodingOption | null
  selectedRewriteIndex: number
  canPrevSite: boolean
  canNextSite: boolean
  onPrevSite: () => void
  onNextSite: () => void
  onSelectRewrite: (index: number) => void
}) {
  // Pin every card to the populated-state min-height so the empty and
  // selected states occupy the same footprint. Prevents the layout jump
  // when the user goes from "Pick a WGGW site" to a populated inspector.
  const cardClass = cn(
    'bg-muted/30 flex min-h-[280px] min-w-0 cursor-default flex-col gap-4 rounded-lg border px-4 pt-4 pb-3 text-xs transition-all',
  )
  const cardHeader = (
    <h3 className="text-foreground text-sm font-semibold tracking-tight">
      Split point design
    </h3>
  )

  if (!selectedSite || !currentRewrite) {
    return (
      <div className={cardClass}>
        {cardHeader}
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground/80 text-center text-sm leading-relaxed">
            Select a split point motif above
          </p>
        </div>
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
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-3">
        {cardHeader}
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
          <div className="text-muted-foreground flex items-center justify-between text-[10px] font-semibold tracking-[0.08em] uppercase">
            <span>Synonymous rewrites</span>
            {selectedSite.rewriteOptions.length > 1 && (
              <span className="text-muted-foreground/70 normal-case">
                {selectedRewriteIndex + 1} of{' '}
                {selectedSite.rewriteOptions.length}
              </span>
            )}
          </div>
          <RewriteRow>
            {selectedSite.rewriteOptions
              .map((option, originalIndex) => ({
                option,
                originalIndex,
                score: scoreRewriteOption(option, species),
              }))
              // Sort best-first by codon-preference score when available;
              // fall back to base-change count asc otherwise (no host picked).
              .sort((a, b) => {
                if (a.score !== null && b.score !== null)
                  return b.score - a.score
                if (a.score !== null) return -1
                if (b.score !== null) return 1
                return a.option.baseChanges - b.option.baseChanges
              })
              .map(({ option, originalIndex, score }) => {
                const active = originalIndex === selectedRewriteIndex
                // Order alone tells the recommendation story. Hover title
                // still surfaces the precise score for users who want it.
                const titleParts = [
                  `${option.baseChanges} bp synonymous change${option.baseChanges === 1 ? '' : 's'} required`,
                  score !== null
                    ? `codon preference ${score.toFixed(2)} (${species})`
                    : null,
                ].filter(Boolean)
                return (
                  <button
                    type="button"
                    key={`${option.newHexamer}-${originalIndex}`}
                    onClick={() => onSelectRewrite(originalIndex)}
                    aria-pressed={active}
                    title={titleParts.join(' · ')}
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
                  </button>
                )
              })}
          </RewriteRow>
        </div>

        <div className="space-y-1.5">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
            Sequence context
          </div>
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
  )
}

// A horizontal scroller for rewrite chips that surfaces the
// "scrollable" affordance via a CSS mask: chips fade to transparent at
// any edge that has content offscreen in that direction. Mask-based
// instead of an overlay-gradient so it's bg-color-agnostic — it just
// dissolves the chips themselves at the edge.
function RewriteRow({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  })

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const update = () => {
      setEdges({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
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
  }, [])

  const fadeStops = (() => {
    if (edges.left && edges.right) {
      return 'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)'
    }
    if (edges.left) {
      return 'linear-gradient(to right, transparent 0, black 24px)'
    }
    if (edges.right) {
      return 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)'
    }
    return undefined
  })()

  return (
    <div
      ref={scrollerRef}
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={
        fadeStops
          ? { maskImage: fadeStops, WebkitMaskImage: fadeStops }
          : undefined
      }
    >
      {children}
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="bg-background text-foreground type-micro inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border px-1 font-mono font-semibold">
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
    <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 font-mono text-[14px] leading-[1.2]">
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
      <div
        ref={scrollerRef}
        className="overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        // Mask the leading and trailing edges so characters that fall
        // outside the visible window dissolve to transparent rather than
        // get hard-clipped mid-glyph. The center (around the splice) is
        // fully opaque.
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
        }}
      >
        <div className="mx-auto flex w-max max-w-full flex-col gap-1">
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

function ShortcutHint({ active }: { active: boolean }) {
  // Static documentation, not duplicate UI: hints describe the shortcut,
  // they don't fire it. Hidden below md (no physical keyboard typically).
  return (
    <div
      className={cn(
        'text-muted-foreground/70 hidden flex-wrap items-center gap-x-3 gap-y-1 text-[10px] transition-opacity md:flex',
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!active}
    >
      <span className="flex items-center gap-1">
        <Kbd>[</Kbd>
        <Kbd>]</Kbd>
        <span>step site</span>
      </span>
      <span className="flex items-center gap-1">
        <Kbd>m</Kbd>
        <span>midpoint</span>
      </span>
      <span className="flex items-center gap-1">
        <Kbd>↵</Kbd>
        <span>find / jump</span>
      </span>
    </div>
  )
}

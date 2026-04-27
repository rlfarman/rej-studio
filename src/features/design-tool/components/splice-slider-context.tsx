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
import { ChevronLeft, ChevronRight, AlignCenter, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { SelectedWggwSite } from '../types/form-schema'
import {
  AAV_MAX_BP,
  MIN_SEQUENCE_LENGTH,
  RECENTLY_ASSIGNED_DURATION_MS,
  STRIP_SMOOTH_SCROLL_THRESHOLD_BP,
  SWAP_TOAST_DURATION_MS,
  SWAP_TOAST_THROTTLE_MS,
  TICK_CLICK_THRESHOLD_PX,
} from './splice-slider/constants'
import {
  costToneFor,
  spliceTone,
  SPLICE_TONES,
  type CostTone,
} from './splice-slider/tones'
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
  pickTopSites,
  roleStylesFor,
  splitPositionToPercent,
} from './splice-slider/sequence-helpers'

interface Props {
  sequence: string
  positions: number[]
  onPositionsChange: (positions: number[]) => void
  onSelectionChange: (sites: (SelectedWggwSite | null)[]) => void
}

export function SpliceSliderContext({
  sequence,
  positions,
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

  // Throttle the swap toast so a single drag-cross emits one notification,
  // not one per pointermove that crosses.
  const lastSwapToastRef = useRef(0)

  // When the user drags a caret past another, auto-swap so positions stay
  // sorted (Splice 1 always 5'-most). The parallel state arrays
  // (activeSitePositions, rewriteSelections) are permuted to match, and
  // activeSpliceIndex follows so the user keeps controlling the same caret
  // visually.
  const setPositionAt = useCallback(
    (idx: number, value: number) => {
      const v = Math.max(1, Math.min(seqLen - 1, value))
      const next = [...positions]
      next[idx] = v
      const indexed = next.map((p, i) => ({ p, original: i }))
      indexed.sort((a, b) => a.p - b.p)
      const permuted = indexed.some((x, i) => x.original !== i)
      if (permuted) {
        setActiveSitePositions((prev) =>
          indexed.map((x) => prev[x.original] ?? null),
        )
        setRewriteSelections((prev) =>
          indexed.map((x) => prev[x.original] ?? { position: null, index: 0 }),
        )
        setActiveSpliceIndex((prev) => {
          const i = indexed.findIndex((x) => x.original === prev)
          return i === -1 ? prev : i
        })
        const now = Date.now()
        if (now - lastSwapToastRef.current > SWAP_TOAST_THROTTLE_MS) {
          lastSwapToastRef.current = now
          toast('Splices reordered to keep Splice 1 5′-most', {
            duration: SWAP_TOAST_DURATION_MS,
          })
        }
      }
      onPositionsChange(indexed.map((x) => x.p))
    },
    [onPositionsChange, positions, seqLen],
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
      if (spliceIdx === undefined && positions.length > 1) {
        let best = 0
        let bestDist = Infinity
        positions.forEach((p, i) => {
          const d = Math.abs(p - site.position)
          if (d < bestDist) {
            best = i
            bestDist = d
          }
        })
        idx = best
      }
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
    [clampedActiveIndex, positions, setPositionAt],
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
      if ((event.key === '1' || event.key === '2') && positions.length > 1) {
        const idx = event.key === '1' ? 0 : 1
        if (idx < positions.length) {
          event.preventDefault()
          setActiveSpliceIndex(idx)
        }
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

  // Cache the removed splice's site + rewrite so a subsequent + Splice
  // restores the user's last selection rather than starting fresh.
  const [splice2Cache, setSplice2Cache] = useState<{
    position: number
    sitePosition: number | null
    rewriteIndex: number
  } | null>(null)

  const addSplice = () => {
    if (positions.length >= 2) return
    const existing = positions[0] ?? midpoint
    // Cache is only restored if (a) the cached position is still distinct
    // from the remaining splice's position, (b) the cached position fits
    // inside the current sequence, and (c) any cached site still exists
    // among the candidate WGGW sites (catches sequence edits that
    // invalidated the original site).
    const cache = splice2Cache
    const cacheIsValid =
      cache !== null &&
      cache.position !== existing &&
      cache.position >= 1 &&
      cache.position < seqLen &&
      (cache.sitePosition === null ||
        wggwSites.some((s) => s.position === cache.sitePosition))
    if (cache && cacheIsValid) {
      const sorted = [existing, cache.position].sort((a, b) => a - b)
      const restoreIdx = sorted.indexOf(cache.position)
      onPositionsChange(sorted)
      setActiveSitePositions((prev) => {
        const next = [...prev]
        while (next.length < 2) next.push(null)
        next[restoreIdx] = cache.sitePosition
        return next
      })
      setRewriteSelections((prev) => {
        const next = [...prev]
        while (next.length < 2) next.push({ position: null, index: 0 })
        next[restoreIdx] = {
          position: cache.sitePosition,
          index: cache.rewriteIndex,
        }
        return next
      })
      setActiveSpliceIndex(restoreIdx)
      setSplice2Cache(null)
      return
    }
    if (cache && !cacheIsValid) {
      // Stale cache (sequence changed significantly): drop it.
      setSplice2Cache(null)
    }
    // No usable cache: default new splice to 2/3 (or 1/3) of the sequence.
    const candidate =
      existing < midpoint
        ? Math.floor((seqLen * 2) / 3)
        : Math.floor(seqLen / 3)
    const next = [existing, candidate].sort((a, b) => a - b)
    onPositionsChange(next)
    setActiveSpliceIndex(next.indexOf(candidate))
  }

  const removeSplice = (idx: number) => {
    if (positions.length <= 1) return
    setSplice2Cache({
      position: positions[idx],
      sitePosition: activeSitePositions[idx] ?? null,
      rewriteIndex: rewriteSelections[idx]?.index ?? 0,
    })
    const next = positions.filter((_, i) => i !== idx)
    setActiveSitePositions((prev) => prev.filter((_, i) => i !== idx))
    setRewriteSelections((prev) => prev.filter((_, i) => i !== idx))
    onPositionsChange(next)
    setActiveSpliceIndex(0)
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
                        title={`Previous WGGW site (splice ${idx + 1})`}
                        aria-label={`Previous WGGW site for splice ${idx + 1}`}
                        className="text-foreground/55 hover:text-foreground inline-flex size-4 items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronLeft className="size-3" strokeWidth={2.5} />
                      </button>
                    )}
                    <button
                      type="button"
                      onPointerDown={(e) => startDrag(idx, e, false)}
                      title={`Splice ${idx + 1} at bp ${pos.toLocaleString()} — drag to move`}
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
                        title={`Next WGGW site (splice ${idx + 1})`}
                        aria-label={`Next WGGW site for splice ${idx + 1}`}
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
                // Segments are colored by which splice "owns" them: the
                // 5′ segment uses splice 1's tone, the 3′ segment uses
                // the last splice's tone (when there is a 2nd splice),
                // and any middle segment(s) stay muted as the "between"
                // region.
                const isFirst = i === 0
                const isLast = i === arr.length - 1
                const segTone = isFirst
                  ? spliceTone(0)
                  : isLast && positions.length > 1
                    ? spliceTone(positions.length - 1)
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
          <div className="flex items-center justify-between gap-3 px-1">
            {positions.length < 2 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSplice}
                title="Add a second splice point (for triple-AAV cassettes)"
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus />
                Add Splice Point
              </Button>
            ) : (
              <span />
            )}
            <ShortcutHint
              active={shortcutsActive}
              spliceCount={positions.length}
            />
          </div>
        </div>

        <div
          className={cn(
            'grid min-w-0 gap-3',
            positions.length > 1 && 'md:grid-cols-2',
          )}
        >
          {positions.map((_pos, idx) => (
            <Inspector
              key={`inspector-${idx}`}
              spliceIndex={idx}
              spliceCount={positions.length}
              tone={spliceTone(idx)}
              isActive={idx === clampedActiveIndex}
              onActivate={() => setActiveSpliceIndex(idx)}
              onRemoveSplice={
                positions.length > 1 ? () => removeSplice(idx) : undefined
              }
              sequence={sequence}
              selectedSite={selectedSites[idx]}
              selectedSiteIndex={selectedSiteIndices[idx] ?? -1}
              totalSites={wggwSites.length}
              topPicks={pickTopSites(wggwSites, activeSitePositions, idx, 6)}
              onSelectSite={handleSelectSite}
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
  const siteByMotifStart = useMemo(() => {
    const map = new Map<number, WggwSiteCandidate>()
    for (const site of sites) map.set(site.motifStart, site)
    return map
  }, [sites])

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
    // Outer card carries the rounded border + bg; the inner div is the
    // actual scroller. Padding on the outer keeps the scrollbar inset
    // from the card's rounded corners (so it doesn't bleed past them)
    // while still being visible as a scroll affordance.
    <div
      role="group"
      aria-label="Sequence context around WGGW split site"
      className="bg-muted/40 rounded-lg border px-2 py-2 font-mono text-[11px] leading-none sm:py-3"
    >
      <div
        ref={stripRef}
        className="overflow-x-auto [scrollbar-color:rgb(0_0_0/0.18)_transparent] [scrollbar-width:thin]"
      >
        <div className="flex items-stretch">
          {ctx.codons.map((codon, codonIdx) => (
            <CodonCard
              key={codon.idx}
              codon={codon}
              site={siteByMotifStart.get(codon.start) ?? null}
              selectedCoverByBase={selectedCoverByBase}
              otherSiteCoverByBase={otherSiteCoverByBase}
              changedBases={changedBases}
              searchMatchBases={searchMatchBases}
              cursorPositions={cursorPositions}
              isLast={codonIdx === ctx.codons.length - 1}
              onSelectSite={onSelectSite}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CodonCard({
  codon,
  site,
  selectedCoverByBase,
  otherSiteCoverByBase,
  changedBases,
  searchMatchBases,
  cursorPositions,
  isLast,
  onSelectSite,
}: {
  codon: SequenceContext['codons'][number]
  site: WggwSiteCandidate | null
  selectedCoverByBase: Map<
    number,
    { spliceIndex: number; site: WggwSiteCandidate }
  >
  otherSiteCoverByBase: Map<number, WggwSiteCandidate>
  changedBases: Map<number, number>
  searchMatchBases: Set<number>
  cursorPositions: number[]
  isLast: boolean
  onSelectSite: (site: WggwSiteCandidate) => void
}) {
  const roleStyles = roleStylesFor(codon.role)
  const startCover = site
    ? [...selectedCoverByBase.values()].find(
        (c) => c.site.position === site.position,
      )
    : undefined
  const siteIsSelected = !!startCover
  const siteSpliceTone = startCover ? spliceTone(startCover.spliceIndex) : null

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
                siteIsSelected && siteSpliceTone
                  ? cn(siteSpliceTone.tickBg, 'h-3 w-2')
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
          siteIsSelected &&
            siteSpliceTone &&
            cn(siteSpliceTone.text, 'font-semibold'),
        )}
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
          const inSelectedMotif = !!selectedCover
          const inOtherSite = !!otherCover
          const coverSite = selectedCover?.site ?? otherCover ?? null
          const isMotifStart = coverSite && coverSite.motifStart === pos
          const isMotifEnd = coverSite && coverSite.motifStart + 3 === pos
          const cutSpliceIndex = cursorPositions.findIndex((cp) => cp === pos)
          const isCutBase = cutSpliceIndex !== -1
          const cutTone = isCutBase ? spliceTone(cutSpliceIndex) : null
          const changedSpliceIdx = changedBases.get(pos) ?? -1
          const isChanged = changedSpliceIdx !== -1
          const changeTone = isChanged ? spliceTone(changedSpliceIdx) : null
          const inSearchMatch = searchMatchBases.has(pos)
          const selectedTone = selectedCover
            ? spliceTone(selectedCover.spliceIndex)
            : null
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
                  'bg-marker/10 text-foreground hover:bg-marker/20 cursor-pointer',
                inSelectedMotif &&
                  selectedTone &&
                  cn(
                    selectedTone.baseBg,
                    selectedTone.baseText,
                    'cursor-pointer',
                  ),
                isMotifStart && 'rounded-l-sm',
                isMotifEnd && 'rounded-r-sm',
                changeTone && changeTone.text,
                inSearchMatch &&
                  'ring-foreground/60 z-10 rounded-sm ring-1 ring-inset',
              )}
            >
              {base}
              {isCutBase && cutTone && (
                <span
                  className={cn(
                    'absolute top-0 bottom-0 -left-px w-px',
                    cutTone.tickBg,
                  )}
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
  spliceIndex,
  spliceCount,
  tone,
  isActive,
  onActivate,
  onRemoveSplice,
  selectedSite,
  selectedSiteIndex,
  totalSites,
  topPicks,
  onSelectSite,
  currentRewrite,
  selectedRewriteIndex,
  canPrevSite,
  canNextSite,
  onPrevSite,
  onNextSite,
  onSelectRewrite,
}: {
  sequence: string
  spliceIndex: number
  spliceCount: number
  tone: (typeof SPLICE_TONES)[number]
  isActive: boolean
  onActivate: () => void
  onRemoveSplice?: () => void
  selectedSite: WggwSiteCandidate | null
  selectedSiteIndex: number
  totalSites: number
  topPicks: WggwSiteCandidate[]
  onSelectSite: (site: WggwSiteCandidate) => void
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
    'flex min-h-[280px] min-w-0 flex-col gap-4 rounded-lg border p-4 text-xs transition-all cursor-pointer',
    spliceCount > 1
      ? isActive
        ? cn('bg-muted/40 ring-2 shadow-sm', tone.caretRing)
        : cn(
            'bg-muted/20 opacity-55 hover:opacity-80',
            'hover:bg-muted/30',
            tone.hoverBorder,
          )
      : 'bg-muted/30 cursor-default',
  )

  const spliceLabel = spliceCount > 1 ? `Splice ${spliceIndex + 1}` : null

  const headerEyebrow = spliceLabel ? (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onActivate}
        className={cn(
          'inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors',
          isActive ? tone.text : 'text-muted-foreground',
        )}
      >
        <span
          className={cn('inline-block size-1.5 rounded-full', tone.caret)}
          aria-hidden="true"
        />
        {spliceLabel}
      </button>
      {onRemoveSplice && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemoveSplice}
          title={`Remove ${spliceLabel}`}
          aria-label={`Remove ${spliceLabel}`}
          className="text-muted-foreground hover:text-foreground size-5"
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  ) : null

  if (!selectedSite || !currentRewrite) {
    const emptyHint =
      spliceCount > 1
        ? spliceIndex === 0
          ? 'Pick the 5′ WGGW site'
          : 'Pick the 3′ WGGW site'
        : 'Pick a WGGW site'
    return (
      <div className={cardClass} onPointerDown={onActivate}>
        {headerEyebrow}
        <div className="text-foreground flex items-center justify-between gap-2 text-sm font-semibold">
          <span>{emptyHint}</span>
          <SiteNav
            label={`${totalSites} site${totalSites === 1 ? '' : 's'}`}
            canPrev={canPrevSite}
            canNext={canNextSite}
            onPrev={onPrevSite}
            onNext={onNextSite}
          />
        </div>
        {topPicks.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
              Top picks
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {topPicks.map((site) => {
                const cost = costToneFor(site.baseChanges)
                return (
                  <button
                    type="button"
                    key={site.position}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectSite(site)
                    }}
                    title={`WGGW ${site.motif} · bp ${site.position.toLocaleString()} · ${
                      site.baseChanges === 0
                        ? 'Native'
                        : `${site.baseChanges} bp change${site.baseChanges === 1 ? '' : 's'}`
                    }`}
                    className="hover:border-primary/30 hover:bg-background/60 text-muted-foreground flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors"
                  >
                    <span className="text-foreground tabular-nums">
                      bp {site.position.toLocaleString()}
                    </span>
                    <span
                      className={cn(
                        'rounded border px-1 py-px text-[9px] font-medium tracking-[0.04em] uppercase',
                        cost.badgeBorder,
                        cost.badgeBg,
                        cost.text,
                      )}
                    >
                      {site.baseChanges === 0
                        ? 'Native'
                        : `${site.baseChanges} bp`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <p className="text-muted-foreground/80 mt-auto text-[11px] leading-relaxed">
          Or click a tick on the slider above, drag a caret, or step through all{' '}
          {totalSites} sites with the{' '}
          <span className="text-foreground">{'< >'}</span> buttons.
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
    <div className={cardClass} onPointerDown={onActivate}>
      {headerEyebrow}
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
          <div className="text-muted-foreground flex items-center justify-between text-[10px] font-medium tracking-[0.08em] uppercase">
            <span>Synonymous rewrites</span>
            {selectedSite.rewriteOptions.length > 1 && (
              <span className="text-muted-foreground/70 normal-case">
                {selectedRewriteIndex + 1} of{' '}
                {selectedSite.rewriteOptions.length}
              </span>
            )}
          </div>
          <RewriteRow>
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
          </RewriteRow>
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

function ShortcutHint({
  active,
  spliceCount,
}: {
  active: boolean
  spliceCount: number
}) {
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
      {spliceCount > 1 && (
        <span className="flex items-center gap-1">
          <Kbd>1</Kbd>
          <Kbd>2</Kbd>
          <span>focus</span>
        </span>
      )}
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

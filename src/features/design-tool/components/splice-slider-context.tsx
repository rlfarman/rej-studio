import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, TriangleAlert } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import type { RewritePick } from '../types/form-schema'
import { MULTI_SPLIT_ENABLED } from '../utils/feature-flags'
import {
  cutPositions,
  picksAfterCaretMove,
  resolveWggwPicks,
  wggwSitesIn,
} from '../utils/wggw-selection'
import {
  AAV_MAX_BP,
  KEYBOARD_PAGE_MIN_BP,
  KEYBOARD_SHIFT_STEP_BP,
  MIN_SEQUENCE_LENGTH,
  RECENTLY_ASSIGNED_DURATION_MS,
  SWAP_TOAST_DURATION_MS,
  SWAP_TOAST_THROTTLE_MS,
  TICK_CLICK_THRESHOLD_PX,
} from './splice-slider/constants'
import { spliceTone } from './splice-slider/tones'
import type { WggwSiteCandidate } from './splice-slider/types'
import {
  buildSegments,
  buildSequenceContext,
  findSequenceMatches,
  nearestSiteIndex,
  splitPositionToPercent,
} from './splice-slider/sequence-helpers'
import { Inspector } from './splice-slider/inspector'
import { LocalSequenceView } from './splice-slider/local-sequence-view'
import { ShortcutHint } from './splice-slider/shortcuts'
import { Toolbar, detectQueryMode } from './splice-slider/toolbar'

interface Props {
  sequence: string
  positions: number[]
  // Host species for the codon-preference score on rewrite chips. 'none'
  // hides the score (no host picked = the score is meaningless).
  species: 'none' | 'human' | 'mouse'
  onPositionsChange: (positions: number[]) => void
  // The person's picks, per split point: the WGGW site (null = the default
  // nearest the caret) and the rewrite option. The parent owns them. The
  // change callbacks take an updater applied to the latest picks, so several
  // updates in one handler (pick a site, then reorder splices) compose.
  sitePicks: (number | null)[]
  rewritePicks: RewritePick[]
  onSitePicksChange: (
    update: (prev: (number | null)[]) => (number | null)[],
  ) => void
  onRewritePicksChange: (update: (prev: RewritePick[]) => RewritePick[]) => void
}

export function SpliceSliderContext({
  sequence,
  positions: inputPositions,
  species,
  onPositionsChange,
  sitePicks,
  rewritePicks,
  onSitePicksChange,
  onRewritePicksChange,
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

  const wggwSites: WggwSiteCandidate[] = wggwSitesIn(sequence)
  const normalizedSequence = sequence.toUpperCase().replace(/U/g, 'T')
  const normalizedSearch = searchValue
    .toUpperCase()
    .replace(/U/g, 'T')
    .replace(/[^ACGT]/g, '')
  const searchMatches = findSequenceMatches(
    normalizedSequence,
    normalizedSearch,
  )
  const activeSearchMatch =
    searchMatches.length > 0 ? (searchMatches[searchMatchIndex] ?? null) : null

  const midpoint = Math.max(1, Math.min(seqLen - 1, Math.floor(seqLen / 2)))
  // Multi-split is hidden behind a flag for the preview release: by default
  // we clamp to a single split point. With the flag on, all positions are
  // kept (clamped into range) so the slider/strip render two carets.
  const positions = normalizePositions(inputPositions, midpoint, seqLen)

  // Write the normalized positions back to the parent when they diverge from
  // the incoming prop (e.g. flag-off collapse to one, or out-of-range clamp).
  useEffect(() => {
    const mismatch =
      inputPositions.length !== positions.length ||
      positions.some((p, i) => inputPositions[i] !== p)
    if (mismatch) onPositionsChange(positions)
  }, [inputPositions, onPositionsChange, positions])

  const spliceCount = Math.max(1, positions.length)
  const [activeSpliceIndex, setActiveSpliceIndex] = useState(0)
  const clampedActiveIndex = Math.min(activeSpliceIndex, spliceCount - 1)
  const activePosition = positions[clampedActiveIndex] ?? midpoint

  // The picks as stored may be shorter or longer than the split points (a
  // fresh form has none); reads and updates see them fitted to `spliceCount`
  // so no update leaves a hole in the arrays.
  const fitSitePicks = (picks: (number | null)[]) =>
    fitToLength(picks, spliceCount, () => null)
  const fitRewritePicks = (picks: RewritePick[]) =>
    fitToLength(picks, spliceCount, () => ({ position: null, index: 0 }))
  const activeSitePositions = fitSitePicks(sitePicks)
  const rewriteSelections = fitRewritePicks(rewritePicks)
  const setActiveSitePositions = (
    update: (prev: (number | null)[]) => (number | null)[],
  ) => onSitePicksChange((prev) => update(fitSitePicks(prev)))
  const setRewriteSelections = (
    update: (prev: RewritePick[]) => RewritePick[],
  ) => onRewritePicksChange((prev) => update(fitRewritePicks(prev)))

  // An unset splice shows the WGGW site nearest its caret rather than an
  // empty inspector (see resolveWggwPicks). Derived during render and never
  // written back: the form resolves the same picks itself on submit.
  const { sites: selectedSites, rewrites: currentRewrites } = resolveWggwPicks(
    wggwSites,
    positions,
    midpoint,
    activeSitePositions,
    rewriteSelections,
  )
  // Which splices are showing a derived site rather than one the user chose,
  // so the inspector can say so.
  const defaultedSiteFlags = activeSitePositions.map(
    (pos, i) => pos === null && selectedSites[i] !== null,
  )
  const selectedSiteIndices = selectedSites.map((site) =>
    site ? wggwSites.findIndex((s) => s.position === site.position) : -1,
  )
  // Where the design is cut, which is the resolved site rather than the
  // caret (see cutPositions). Every bp this editor states — the readout,
  // the fragment sizes, the cut line, aria-valuetext — is measured here, so
  // the summary and the inspector cannot disagree. The caret keeps its own
  // position: it is what the person drags and what picks the site.
  const cuts = cutPositions(selectedSites, positions)
  const activeCut = cuts[clampedActiveIndex] ?? activePosition

  // Fragments are measured at the cuts, so the sizes — and the packaging
  // verdict drawn from them — are the ones the design delivers.
  const segments = buildSegments(cuts, seqLen)
  // The AAV packaging limit is the editor's most consequential constraint,
  // so an over-limit fragment gets named in text (see the notice below the
  // track) and in the slider's value text, not only tinted in the bar.
  const overLimitNames = segments
    .filter((seg) => seg.end - seg.start > AAV_MAX_BP)
    .map((seg) => seg.label || 'middle')
  const overLimitNotice =
    overLimitNames.length === 0
      ? null
      : `The ${joinNames(overLimitNames)} fragment${
          overLimitNames.length === 1 ? '' : 's'
        } ${
          overLimitNames.length === 1 ? 'exceeds' : 'exceed'
        } the ~${AAV_MAX_BP.toLocaleString()} bp AAV packaging limit, so this design will not fit a single AAV. You can still run it — move the split point to balance the fragments${
          MULTI_SPLIT_ENABLED ? ' or add a second split point' : ''
        }.`

  const frameContext = buildSequenceContext(sequence)

  // Throttle the swap toast so a single drag-cross emits one notification,
  // not one per pointermove that crosses. Only used in multi-split mode. A
  // cooldown timer rather than a Date.now() timestamp: the React Compiler's
  // purity check can't tell setPositionAt only runs in event handlers.
  const swapToastCoolingRef = useRef(false)

  // In single-split mode this just clamps and writes the one position. In
  // multi-split mode, dragging a caret past another auto-swaps so positions
  // stay sorted (Splice 1 always 5′-most); the parallel state arrays
  // (activeSitePositions, rewriteSelections) and activeSpliceIndex are
  // permuted to match so the user keeps controlling the same caret visually.
  //
  // Every caret move routes through here, so this is also where a site the
  // caret has left stops being the design's: moving the caret away drops
  // that splice's pick (picksAfterCaretMove) and the nearest-site preselect
  // takes over. Without it the editor submitted the old site while every
  // number on screen named the new caret. A pick made by choosing a site
  // survives, because handleSelectSite moves the caret onto it first.
  const clearStalePick = (idx: number, position: number) => {
    // Cheap guard off the rendered picks: skip the update entirely during a
    // drag once there is nothing left to drop.
    if ((activeSitePositions[idx] ?? null) === null) return
    setActiveSitePositions((prev) => picksAfterCaretMove(prev, idx, position))
  }

  const setPositionAt = (idx: number, value: number) => {
    const v = Math.max(1, Math.min(seqLen - 1, value))
    if (!MULTI_SPLIT_ENABLED) {
      clearStalePick(0, v)
      onPositionsChange([v])
      return
    }
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
      if (!swapToastCoolingRef.current) {
        swapToastCoolingRef.current = true
        window.setTimeout(() => {
          swapToastCoolingRef.current = false
        }, SWAP_TOAST_THROTTLE_MS)
        toast('Splices reordered to keep Splice 1 5′-most', {
          duration: SWAP_TOAST_DURATION_MS,
        })
      }
    }
    // The moved splice's own slot after any reorder. The picks were
    // permuted just above and these updaters compose on the latest value,
    // so this drops the pick of the splice that moved, not its neighbour's.
    const movedIdx = indexed.findIndex((x) => x.original === idx)
    const slot = movedIdx === -1 ? idx : movedIdx
    if (permuted) {
      setActiveSitePositions((prev) => picksAfterCaretMove(prev, slot, v))
    } else {
      clearStalePick(slot, v)
    }
    onPositionsChange(indexed.map((x) => x.p))
  }

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
  const setHoveredTick = (sitePosition: number | null) => {
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
  }

  // When a tick is clicked without an explicit splice index, assign it to
  // the splice whose caret is nearest the chosen site. This matches the
  // user's spatial intuition (clicking a tick on the right side of the
  // sequence "obviously" wants the right-side splice).
  const handleSelectSite = (site: WggwSiteCandidate, spliceIdx?: number) => {
    let idx = spliceIdx ?? clampedActiveIndex
    if (
      MULTI_SPLIT_ENABLED &&
      spliceIdx === undefined &&
      positions.length > 1
    ) {
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
  }

  const jumpToSibling = (dir: -1 | 1) => {
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
  }

  // Window shortcuts while the editor is active ([ ] m 1 2). An effect
  // event: it always sees the current positions and handlers, and the
  // listeners below subscribe once.
  const onWindowKeyDown = useEffectEvent((event: KeyboardEvent) => {
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
    if (
      MULTI_SPLIT_ENABLED &&
      (event.key === '1' || event.key === '2') &&
      positions.length > 1
    ) {
      const idx = event.key === '1' ? 0 : 1
      if (idx < positions.length) {
        event.preventDefault()
        setActiveSpliceIndex(idx)
      }
    }
  })

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      setShortcutsActive(!!target && !!rootRef.current?.contains(target))
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null
      setShortcutsActive(!!target && !!rootRef.current?.contains(target))
    }

    // The latest handler, without re-subscribing each render.
    const handleWindowKeyDown = (event: KeyboardEvent) => onWindowKeyDown(event)

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('focusin', handleFocusIn)
    window.addEventListener('keydown', handleWindowKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('focusin', handleFocusIn)
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [])

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

  // The standard slider keys, on the role="slider" track: arrows step a
  // base (Shift a codon-ish 10), PageUp/PageDown a twentieth of the
  // sequence, Home/End the ends. The editor's own [ ] m 1 2 shortcuts are
  // handled on window and are untouched by this.
  const handleTrackKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEYBOARD_SHIFT_STEP_BP : 1
    const page = Math.max(KEYBOARD_PAGE_MIN_BP, Math.round(seqLen / 20))
    let next: number
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = activePosition - step
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = activePosition + step
        break
      case 'PageDown':
        next = activePosition - page
        break
      case 'PageUp':
        next = activePosition + page
        break
      case 'Home':
        next = 1
        break
      case 'End':
        next = seqLen - 1
        break
      default:
        return
    }
    event.preventDefault()
    const clamped = Math.max(1, Math.min(seqLen - 1, next))
    jumpToPosition(clamped)
    scrollStripToPosition(clamped)
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
    // Restore the cache only if it's still distinct from the remaining
    // splice, fits the current sequence, and (when a site was cached) that
    // site still exists among the candidates.
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
              // The readout rides on the cut, not the caret: it states the
              // bp the design is delivered at. When the two differ the
              // caret shows as its own faint marker on the track below.
              const cut = cuts[idx] ?? pos
              const pct = splitPositionToPercent(cut, seqLen)
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
                        className="inline-flex size-4 items-center justify-center rounded-full text-foreground/55 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronLeft className="size-3" strokeWidth={2.5} />
                      </button>
                    )}
                    <button
                      type="button"
                      onPointerDown={(e) => startDrag(idx, e, false)}
                      title={
                        cut === pos
                          ? `Split point at bp ${pos.toLocaleString()} — drag to move`
                          : `Cuts at bp ${cut.toLocaleString()}, the WGGW motif nearest your split point at bp ${pos.toLocaleString()} — drag to move`
                      }
                      className={cn(
                        'inline-flex min-w-max cursor-grab touch-none items-center rounded-full border bg-background px-2 py-0.5 font-mono text-xs font-semibold whitespace-nowrap tabular-nums shadow-sm transition-all active:cursor-grabbing',
                        isActive
                          ? cn('ring-2', tone.caretRing, tone.text)
                          : 'text-muted-foreground opacity-70',
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
                      {cut.toLocaleString()} bp
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
                        className="inline-flex size-4 items-center justify-center rounded-full text-foreground/55 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
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
            aria-valuetext={
              (activeCut === activePosition
                ? `bp ${activePosition.toLocaleString()} of ${seqLen.toLocaleString()}`
                : `bp ${activePosition.toLocaleString()} of ${seqLen.toLocaleString()} — cuts at bp ${activeCut.toLocaleString()}, the nearest WGGW motif`) +
              (overLimitNames.length === 0
                ? ''
                : ` — ${overLimitNames.length} fragment${
                    overLimitNames.length === 1 ? '' : 's'
                  } over the ~${AAV_MAX_BP.toLocaleString()} bp AAV packaging limit`)
            }
            onPointerDown={handleTrackPointerDown}
            onKeyDown={handleTrackKeyDown}
            className="relative h-18 cursor-ew-resize touch-none rounded-2xl border bg-background/80 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="absolute inset-x-0 top-0 z-10 flex h-11 overflow-hidden rounded-t-2xl">
              {segments.map((seg, i, arr) => {
                // Segments are colored by which splice "owns" them: the 5′
                // segment uses splice 1's tone; with a 2nd splice the 3′
                // segment uses the last splice's tone, and middle segment(s)
                // stay muted as the "between" region.
                const isFirst = i === 0
                const isLast = i === arr.length - 1
                const segTone = isFirst
                  ? spliceTone(0)
                  : MULTI_SPLIT_ENABLED && isLast && positions.length > 1
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
                        'pointer-events-none flex min-w-0 items-center gap-1 px-4 text-sm font-semibold tracking-[0.01em] tabular-nums',
                        overAAV ? 'text-danger-soft' : segTone.text,
                      )}
                      title={
                        overAAV
                          ? `${fragmentBp.toLocaleString()} bp exceeds the ~${AAV_MAX_BP.toLocaleString()} bp AAV packaging limit`
                          : `${fragmentBp.toLocaleString()} bp · within the AAV packaging limit`
                      }
                    >
                      {/* A shape as well as a tint: the packaging verdict
                          cannot be carried by colour alone. */}
                      {overAAV && (
                        <TriangleAlert
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">
                        {seg.label && `${seg.label} · `}
                        {fragmentBp.toLocaleString()} bp
                        {overAAV && ' · over limit'}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
            <div
              ref={wggwStripRef}
              role="presentation"
              className="absolute inset-x-0 bottom-0 h-7 cursor-pointer overflow-hidden rounded-b-2xl border-t bg-background/70"
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
                  className="pointer-events-none absolute inset-y-0 bg-foreground/10"
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
                return (
                  <span
                    key={`${site.position}-${i}`}
                    data-site-pos={site.position}
                    aria-hidden="true"
                    title={`WGGW ${site.motif} · bp ${site.position.toLocaleString()} · ${site.baseChanges} bp change${site.baseChanges === 1 ? '' : 's'}`}
                    className={cn(
                      'pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all',
                      isSelected
                        ? cn(spliceTone(selectedAt).tickBg, 'h-5 w-1.5')
                        : cn(
                            'bg-marker',
                            'h-4 w-1',
                            'data-[tick-hovered=true]:z-10 data-[tick-hovered=true]:h-5 data-[tick-hovered=true]:w-1.5 data-[tick-hovered=true]:ring-1 data-[tick-hovered=true]:ring-foreground/30',
                          ),
                    )}
                    style={{ left: `${x}%` }}
                  />
                )
              })}
            </div>
            {positions.map((pos, idx) => {
              const cut = cuts[idx] ?? pos
              const tone = spliceTone(idx)
              return (
                <div key={`cut-${idx}`}>
                  {/* The cut: where the design is split. */}
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 z-0 w-0 -translate-x-1/2"
                    style={{ left: `${splitPositionToPercent(cut, seqLen)}%` }}
                    aria-hidden="true"
                  >
                    <div
                      className={cn(
                        'absolute inset-y-0 left-1/2 z-0 -translate-x-1/2 border-l-2',
                        tone.border,
                      )}
                    />
                  </div>
                  {/* The caret, when the motif puts the cut elsewhere: the
                      position the person chose, which picks the motif. */}
                  {cut !== pos && (
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 z-0 w-0 -translate-x-1/2"
                      style={{
                        left: `${splitPositionToPercent(pos, seqLen)}%`,
                      }}
                      aria-hidden="true"
                    >
                      <div className="absolute inset-y-0 left-1/2 z-0 -translate-x-1/2 border-l border-dashed border-foreground/35" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Real text, on screen, for the limit the bar only tints. Live
              so it is announced when a move puts a fragment over (or back
              under) the limit; the wording names the fragments rather than
              their sizes, so dragging doesn't re-announce on every frame. */}
          {overLimitNotice && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger-soft"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                <span className="font-semibold">
                  Too large to package into one AAV.{' '}
                </span>
                {overLimitNotice}
              </p>
            </div>
          )}

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
            {MULTI_SPLIT_ENABLED && positions.length < 2 ? (
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
            MULTI_SPLIT_ENABLED && positions.length > 1 && 'md:grid-cols-2',
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
                MULTI_SPLIT_ENABLED && positions.length > 1
                  ? () => removeSplice(idx)
                  : undefined
              }
              sequence={sequence}
              selectedSite={selectedSites[idx]}
              isDefaultedSite={defaultedSiteFlags[idx] ?? false}
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

/** The split points clamped into range; one unless multi-split is on. */
function normalizePositions(
  inputPositions: number[],
  midpoint: number,
  seqLen: number,
): number[] {
  const clamp = (n: number) => Math.max(1, Math.min(seqLen - 1, n))
  if (MULTI_SPLIT_ENABLED) {
    const src = inputPositions.length ? inputPositions : [midpoint]
    return src.map(clamp)
  }
  return [clamp(inputPositions[0] ?? midpoint)]
}

/** "5′", "5′ and 3′", "5′, middle and 3′". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** `values` padded with `fill()` or trimmed to `length`; the same array when it already fits. */
function fitToLength<T>(values: T[], length: number, fill: () => T): T[] {
  if (values.length === length) return values
  const next = values.slice(0, length)
  while (next.length < length) next.push(fill())
  return next
}

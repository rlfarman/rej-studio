import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TermHint } from '@/components/term-hint'
import { translateCodon } from '@/lib/bio/genetic-code'
import type { WggwRecodingOption } from '@/lib/bio/sequence-utils'
import { cn } from '@/lib/utils'
import { designToolCopy } from '../../copy'
import { SequenceContextTable } from './sequence-context-table'
import {
  applyRewriteToSequence,
  buildAminoAcidGuide,
  buildMotifGuide,
  buildSplitContext,
  getEditedPositions,
  rankedRewriteOptions,
} from './sequence-helpers'
import type { spliceTone } from './tones'
import type { WggwSiteCandidate } from './types'

const rewriteCopy = designToolCopy.splitPoint.rewrites
const editorCopy = designToolCopy.spliceEditor

export function Inspector({
  sequence,
  selectedSite,
  isDefaultedSite = false,
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
  spliceIndex,
  spliceCount = 1,
  tone,
  isActive = false,
  onActivate,
  onRemoveSplice,
}: {
  sequence: string
  selectedSite: WggwSiteCandidate | null
  /** True when the site was derived from the caret, not chosen by the user. */
  isDefaultedSite?: boolean
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
  // Multi-split chrome (only meaningful when spliceCount > 1). When the
  // multi-split flag is off the parent passes spliceCount === 1, so the
  // card renders in its plain single-split form.
  spliceIndex?: number
  spliceCount?: number
  tone?: ReturnType<typeof spliceTone>
  isActive?: boolean
  onActivate?: () => void
  onRemoveSplice?: () => void
}) {
  const isMulti = spliceCount > 1
  const spliceLabel =
    isMulti && spliceIndex !== undefined
      ? editorCopy.spliceLabel(spliceIndex + 1)
      : null

  // Pin every card to the populated-state min-height so the empty and
  // selected states occupy the same footprint. Prevents the layout jump
  // when the user goes from "Pick a WGGW site" to a populated inspector.
  // In multi-split mode the inactive cards dim and gain a hover affordance
  // so it's clear which splice is being edited.
  const cardClass = cn(
    // The floor keeps the card from jumping as a site is picked; on a phone
    // the editor above is already tall, so the empty state goes without it.
    'flex min-w-0 flex-col gap-4 rounded-2xl border px-4 pt-4 pb-3 text-xs transition-all md:min-h-[280px]',
    isMulti
      ? isActive
        ? cn('cursor-pointer bg-muted/40 shadow-sm ring-2', tone?.caretRing)
        : cn(
            'cursor-pointer bg-muted/20 opacity-55 hover:bg-muted/30 hover:opacity-80',
            tone?.hoverBorder,
          )
      : 'cursor-default bg-muted/30',
  )

  // Header left side: the section title, or — in multi-split mode — a
  // clickable splice eyebrow with its tone dot that activates the card.
  const headerLeft = isMulti ? (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight transition-colors',
        isActive ? tone?.text : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span
        className={cn('inline-block size-1.5 rounded-full', tone?.caret)}
        aria-hidden="true"
      />
      {spliceLabel}
    </button>
  ) : (
    <h3 className="text-sm font-semibold tracking-tight text-foreground">
      {editorCopy.heading}
    </h3>
  )

  const removeButton =
    isMulti && onRemoveSplice ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemoveSplice}
        title={editorCopy.removeSplice(spliceLabel ?? '')}
        aria-label={editorCopy.removeSplice(spliceLabel ?? '')}
        // A 20px glyph button: the pseudo-element stretches its hit area
        // to 40px without moving the card's header.
        className="relative size-5 text-muted-foreground before:absolute before:-inset-2.5 hover:text-foreground"
      >
        <X className="size-3" />
      </Button>
    ) : null

  if (!selectedSite || !currentRewrite) {
    return (
      <div className={cardClass} onPointerDown={onActivate}>
        <div className="flex items-center justify-between gap-3">
          {headerLeft}
          {removeButton}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
          <p className="text-sm font-medium text-foreground/80">
            {totalSites === 0
              ? designToolCopy.splitPoint.noSitesShort
              : designToolCopy.splitPoint.emptyTitle}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {totalSites === 0
              ? designToolCopy.splitPoint.noSites
              : designToolCopy.splitPoint.emptyBody}
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

  // The chips and the counter beside them read one order, so they cannot
  // disagree about which option is "2 of 6".
  const ranked = rankedRewriteOptions(selectedSite.rewriteOptions, species)
  const selectedRank =
    ranked.findIndex((entry) => entry.originalIndex === selectedRewriteIndex) +
    1

  return (
    <div className={cardClass} onPointerDown={onActivate}>
      <div className="flex items-center justify-between gap-3">
        {headerLeft}
        <div className="flex items-center gap-2">
          {removeButton}
          <SiteNav
            label={
              <>
                Site{' '}
                <span className="font-medium text-foreground">
                  {selectedSiteIndex >= 0 ? selectedSiteIndex + 1 : 0}
                </span>
                <span className="text-muted-foreground">/{totalSites}</span>
              </>
            }
            canPrev={canPrevSite}
            canNext={canNextSite}
            onPrev={onPrevSite}
            onNext={onNextSite}
          />
        </div>
      </div>

      {isDefaultedSite && (
        <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">
          {designToolCopy.splitPoint.preselected(
            selectedSite.position.toLocaleString(),
          )}
        </p>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            <span className="inline-flex items-center gap-0.5">
              {rewriteCopy.heading}
              {/* No size override: the trigger's 24px icon is what gives
                  it the 44px tap target, which a smaller one would lose. */}
              <TermHint
                topic={rewriteCopy.hintTopic}
                hint={rewriteCopy.hint(species === 'none' ? null : species)}
              />
            </span>
            {ranked.length > 1 && (
              <span className="text-muted-foreground normal-case">
                {rewriteCopy.position(selectedRank, ranked.length)}
              </span>
            )}
          </div>
          <RewriteRow>
            {ranked.map(({ option, originalIndex, score }, rank) => {
              const active = originalIndex === selectedRewriteIndex
              return (
                <button
                  type="button"
                  key={`${option.newHexamer}-${originalIndex}`}
                  onClick={() => onSelectRewrite(originalIndex)}
                  aria-pressed={active}
                  aria-label={rewriteCopy.optionAria(
                    rank + 1,
                    ranked.length,
                    option.baseChanges,
                    score === null ? null : score.toFixed(2),
                  )}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 font-mono text-[12px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
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
                      <span className="col-start-2 text-center font-medium text-muted-foreground">
                        {translateCodon(option.newCodons[0]) ?? '?'}
                      </span>
                      <span className="col-start-6 text-center font-medium text-muted-foreground">
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
                    {/* The cost of the option, on the chip. It was in the
                        title, which a touch user never sees. */}
                    <span className="text-[9px] leading-none font-medium tracking-[0.04em] opacity-80">
                      {rank === 0
                        ? `${rewriteCopy.best} · ${rewriteCopy.baseChanges(option.baseChanges)}`
                        : rewriteCopy.baseChanges(option.baseChanges)}
                    </span>
                  </span>
                </button>
              )
            })}
          </RewriteRow>
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {editorCopy.contextHeading}
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
                label: editorCopy.originalRow,
                text: originalSplitContext.displayText,
                boundaryIndexes: originalSplitContext.boundaryIndexes,
                editedIndexes: originalSplitContext.displayEditedIndexes,
              },
              {
                label: editorCopy.designedRow,
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
    <div className="inline-flex items-center gap-1 font-mono text-[11px] font-normal text-muted-foreground tabular-nums">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onPrev}
        disabled={!canPrev}
        title={editorCopy.prevSiteShortcut}
        aria-label={editorCopy.prevSite}
        className="relative size-5 before:absolute before:-inset-0.5 hover:text-foreground [&_svg:not([class*='size-'])]:size-3.5"
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
        title={editorCopy.nextSiteShortcut}
        aria-label={editorCopy.nextSite}
        className="relative size-5 before:absolute before:-inset-0.5 hover:text-foreground [&_svg:not([class*='size-'])]:size-3.5"
      >
        <ChevronRight />
      </Button>
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
      className="-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden"
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

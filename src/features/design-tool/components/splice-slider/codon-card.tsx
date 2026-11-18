import { cn } from '@/lib/utils'
import { designToolCopy } from '../../copy'
import { roleStylesFor } from './sequence-helpers'
import { spliceTone } from './tones'
import type { SequenceContext, WggwSiteCandidate } from './types'

export function CodonCard({
  codon,
  selectedCoverByBase,
  otherSiteCoverByBase,
  motifSitesByBase,
  selectedSiteIndexByPosition,
  changedBases,
  searchMatchBases,
  hoveredSitePosition,
  rovingSitePosition,
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
  // The one site that owns the strip's single tab stop (roving tabindex).
  // Every other site button stays at tabIndex -1 so the strip costs one
  // Tab press rather than one per candidate site.
  rovingSitePosition: number | null
  isLast: boolean
  onHoverSite: (position: number | null) => void
  onSelectSite: (site: WggwSiteCandidate) => void
}) {
  const roleStyles = roleStylesFor(codon.role)

  // The card divider is a pseudo-element rather than a span, and a base with
  // no motif over it is bare text rather than a wrapped span: at a
  // full-length CDS the strip is thousands of these, and every node per card
  // is ~3,400 nodes the browser lays out and React diffs on each caret move
  // (see splice-slider-context.perf.test.tsx).
  const cardClasses = cn(
    'relative flex w-12 shrink-0 flex-col items-stretch pt-3 text-center',
    !isLast &&
      'after:pointer-events-none after:absolute after:top-3 after:right-0 after:bottom-0 after:border-r after:border-border/60',
  )

  return (
    <div className={cardClasses}>
      <div className="pointer-events-none absolute top-0 left-0 z-10 w-max -translate-x-1/2 text-[10px] leading-3 text-muted-foreground tabular-nums">
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
              'cursor-pointer border-0 bg-transparent p-0 font-mono leading-none text-foreground focus-visible:z-20 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
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
              'z-10 rounded-sm ring-1 ring-foreground/60 ring-inset',
          )
          // Bases under no motif — the great majority — need no stacking
          // context, so they render as text with no wrapper element.
          const baseContent =
            motifSites.length === 0 ? (
              base
            ) : (
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
                data-site-start={
                  isInteractiveStart ? coverSite.position : undefined
                }
                tabIndex={
                  isInteractiveStart &&
                  coverSite.position === rovingSitePosition
                    ? 0
                    : -1
                }
                aria-current={
                  selectedSiteIndexByPosition.has(coverSite.position)
                    ? 'true'
                    : undefined
                }
                title={`bp ${pos.toLocaleString()} · WGGW ${coverSite.motif}`}
                aria-label={designToolCopy.splitPoint.siteButtonAria(
                  coverSite.motif,
                  coverSite.position,
                  coverSite.baseChanges,
                )}
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

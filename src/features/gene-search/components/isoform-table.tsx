import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  createTooltipHandle,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  createDropdownMenuHandle,
} from '@/components/ui/dropdown-menu'
import {
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  MoreHorizontal,
  PackageOpen,
  WandSparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useMediaQuery } from '@/hooks/use-media-query'
import { downloadTextFile } from '@/lib/download-file'
import {
  buildIsoformFasta,
  isoformFastaFilename,
} from '@/features/gene-search/utils/isoform-fasta'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
  type Suitability,
} from '@/lib/bio/design-suitability'
import {
  computeGcPercent,
  countCpG,
  rankWggwByBalance,
} from '@/lib/bio/sequence-utils'
import { IsoformValidationBadges } from './isoform-validation-badges'
import { IsoformSplitPreview } from './isoform-split-preview'
import { TermHint } from '@/components/term-hint'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'
import {
  ariaSortFor,
  nextIsoformSort,
  isoformSortSearch,
  parseIsoformSort,
  sortIsoforms,
  type IsoformSort,
  type IsoformSortKey,
} from '@/features/gene-search/utils/isoform-sort'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.isoformTable
const terms = geneSearchCopy.terms

/** Pre-optimized sequence package for an isoform (static, built offline). */
function preOptimizedZipUrl(isoformId: string) {
  return `https://rej-seq-1.s3.us-west-004.backblazeb2.com/rej/v1.0/zips/${isoformId}_v1.0.zip`
}

/**
 * Whether a ready-made package exists for this isoform. Every ZIP in the
 * corpus is a two-fragment design, so a CDS that needs three vectors has no
 * usable one — offering it would hand a scientist a file whose fragments both
 * over-pack an AAV. Those isoforms go through the design tool instead.
 */
function hasPreOptimizedZip(suitability: Suitability) {
  return suitability !== 'triple-aav'
}

interface IsoformListProps {
  isoforms: IsoformListItem[]
  highlightedIsoformId?: string
}

const COLUMN_COUNT = 9

/** How long the arrival highlight ring stays on once the row is in view. */
const HIGHLIGHT_RING_MS = 2000

/**
 * Frames to keep re-asserting the arrival scroll over. The router's scroll
 * restoration lands after this effect runs and puts the scroller back at the
 * top, so a single `scrollIntoView` is silently undone and the linked row
 * never appears. Re-asserting for a few frames outlasts the restoration.
 */
const SCROLL_SETTLE_FRAMES = 12

function isInViewport(el: Element) {
  const rect = el.getBoundingClientRect()
  return rect.bottom > 0 && rect.top < window.innerHeight
}

/**
 * Where a row's hover quick actions can show: a pointer that hovers, on a
 * screen wider than Tailwind's `sm`. Elsewhere the row's menu has the same
 * actions, and the quick actions aren't mounted at all.
 */
const QUICK_ACTIONS_QUERY = '(min-width: 40rem) and (not (pointer: coarse))'

type RowMenuHandle = ReturnType<typeof createDropdownMenuHandle<IsoformRowData>>
type QuickActionTipHandle = ReturnType<typeof createTooltipHandle<string>>

type IsoformRowData = IsoformListItem & {
  gcPercent: number
  cpgCount: number
  wggwCount: number
  suitability: Suitability
}

/**
 * Isoforms of one gene. Every isoform shares the gene's species, so there is
 * no species filter here; the page's species lives in its URL. The sort is
 * in the URL too (`?sort=&dir=`), so a sorted view can be shared.
 */
export default function IsoformTable({
  isoforms,
  highlightedIsoformId,
}: IsoformListProps) {
  const search = useSearch({ from: '/genes/$symbol' })
  const navigate = useNavigate({ from: '/genes/$symbol' })
  // The gene the page is on, so a copied or downloaded record can say which
  // gene it came from without the route having to pass it down.
  const { symbol: geneSymbol } = useParams({ from: '/genes/$symbol' })
  const sort = parseIsoformSort(search)
  // A toast, because Base UI closes the menu on click: an item that swaps to
  // "Copied!" swaps a label nobody is left looking at, which made a failed
  // copy the only one that said anything.
  const { copy: copyText } = useCopyToClipboard()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    highlightedIsoformId ? new Set([highlightedIsoformId]) : new Set(),
  )
  // One "more" menu and one quick-action tooltip for the whole table, rather
  // than a Base UI root per row (three per isoform): rows render only their
  // triggers, which pass the row along as the payload. Base UI controls are
  // most of what the gene page costs to render on a phone.
  const [rowMenu] = useState(createDropdownMenuHandle<IsoformRowData>)
  const [quickActionTip] = useState(createTooltipHandle<string>)
  // The quick actions are two buttons and two tooltip triggers a row, so
  // they're left out where they can't show, not just hidden with CSS.
  const showQuickActions = useMediaQuery(QUICK_ACTIONS_QUERY)

  // Each metric is computed once per isoform, not once per comparison.
  const rows: IsoformRowData[] = isoforms.map((isoform) => {
    const upperSeq = isoform.codingSequence.toUpperCase()
    return {
      ...isoform,
      gcPercent: computeGcPercent(upperSeq),
      cpgCount: countCpG(upperSeq),
      wggwCount: rankWggwByBalance(upperSeq).length,
      suitability: assessDesignSuitability(isoform.codingSequence),
    }
  })
  const sortedRows = sortIsoforms(rows, sort)

  // Replaces the history entry: re-sorting isn't a step to go back
  // through. The sort is client-side, so nothing reloads.
  const toggleSort = (key: IsoformSortKey) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...isoformSortSearch(nextIsoformSort(sort, key)),
      }),
      replace: true,
      resetScroll: false,
    })
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allExpanded =
    isoforms.length > 0 && isoforms.every((i) => expandedIds.has(i.id))

  const toggleExpandAll = () => {
    setExpandedIds(allExpanded ? new Set() : new Set(isoforms.map((i) => i.id)))
  }

  if (isoforms.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {copy.empty}
      </p>
    )
  }

  const sortProps = { sort, onSort: toggleSort }

  return (
    <>
      {/* The scroller is the table's own container, so the header below can
          pin to it: a `sticky` header in a container with no height of its
          own has nothing to stick to and scrolls away with the rows. Twenty
          isoforms is normal (TP53 has 20), and past about ten rows the
          numeric columns were unlabelled. */}
      <Table containerClassName="max-h-[75svh] overflow-auto">
        {/* Named, like the identity matrix below: the page has two tables, and
            an unnamed one is a row of anonymous numbers in a screen reader's
            table list. */}
        <TableCaption className="sr-only">
          {copy.caption(geneSymbol)}
        </TableCaption>
        {/* Opaque and above the rows: a translucent header lets the rows it
            is pinned over read through it. */}
        <TableHeader className="sticky top-0 z-20 bg-background [&_th]:bg-background">
          <TableRow>
            <TableHead className="w-11 min-w-11 p-0">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={toggleExpandAll}
                      aria-expanded={allExpanded}
                      className="flex h-full w-full items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      aria-label={
                        allExpanded ? copy.collapseAllAria : copy.expandAllAria
                      }
                    >
                      {allExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                  }
                />
                <TooltipContent>
                  {allExpanded ? copy.collapseAll : copy.expandAll}
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <SortableHead
              label={
                <>
                  <span className="hidden sm:inline">
                    Ensembl Transcript ID
                  </span>
                  <span className="sm:hidden">ENST</span>
                </>
              }
              sortKey="enst"
              {...sortProps}
            />
            <SortableHead label="CDS" sortKey="cdsLength" {...sortProps} />
            <SortableHead
              label="Protein"
              sortKey="proteinLength"
              {...sortProps}
              className="hidden sm:table-cell"
            />
            <SortableHead
              label={terms.gc.label}
              hint={terms.gc.hint}
              sortKey="gcPercent"
              {...sortProps}
              className="hidden sm:table-cell"
            />
            <SortableHead
              label={terms.cpg.label}
              hint={terms.cpg.hint}
              sortKey="cpg"
              {...sortProps}
              className="hidden lg:table-cell"
            />
            <SortableHead
              label={terms.wggw.label}
              hint={terms.wggw.hint}
              sortKey="wggw"
              {...sortProps}
              className="hidden lg:table-cell"
            />
            {/* Never hidden: it is the column the page exists for, and a
                hidden header takes its sort control with it — a shared
                `?sort=suitability` link then reordered the rows with no
                header, no arrow and no way to clear it. */}
            <SortableHead
              label={terms.suitability.label}
              hint={terms.suitability.hint}
              sortKey="suitability"
              {...sortProps}
            />
            <TableHead className="w-px">
              <span className="sr-only">{copy.actionsHeader}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <IsoformRow
              key={row.id}
              isoform={row}
              isExpanded={expandedIds.has(row.id)}
              isHighlighted={row.id === highlightedIsoformId}
              rowMenu={rowMenu}
              quickActionTip={showQuickActions ? quickActionTip : null}
              onToggleExpanded={toggleExpanded}
            />
          ))}
        </TableBody>
      </Table>
      <DropdownMenu handle={rowMenu}>
        {({ payload: isoform }) =>
          isoform && (
            <IsoformMenuContent
              isoform={isoform}
              geneSymbol={geneSymbol}
              copyText={copyText}
            />
          )
        }
      </DropdownMenu>
      <Tooltip handle={quickActionTip}>
        {({ payload: label }) => <TooltipContent>{label}</TooltipContent>}
      </Tooltip>
    </>
  )
}

function IsoformRow({
  isoform,
  isExpanded,
  isHighlighted,
  rowMenu,
  quickActionTip,
  onToggleExpanded,
}: {
  isoform: IsoformRowData
  isExpanded: boolean
  isHighlighted?: boolean
  rowMenu: RowMenuHandle
  /** Null where the quick actions can't show (QUICK_ACTIONS_QUERY). */
  quickActionTip: QuickActionTipHandle | null
  onToggleExpanded: (id: string) => void
}) {
  const { gcPercent, cpgCount, wggwCount } = isoform
  const suitConfig = getSuitabilityConfig(isoform.suitability)
  const zipAvailable = hasPreOptimizedZip(isoform.suitability)
  const [ringVisible, setRingVisible] = useState(false)

  useEffect(() => {
    if (!isHighlighted) return
    const row = document.getElementById(`isoform-row-${isoform.id}`)
    if (!row) return

    let frame = 0
    let framesLeft = SCROLL_SETTLE_FRAMES
    let ringTimer: ReturnType<typeof setTimeout> | undefined
    let ringStarted = false

    // Re-asserting the scroll would otherwise fight a reader who starts
    // scrolling in the same breath, so their first move ends it.
    let abandoned = false
    const abandon = () => {
      abandoned = true
    }
    const userScrollEvents = ['wheel', 'touchstart', 'keydown'] as const
    for (const name of userScrollEvents) {
      window.addEventListener(name, abandon, { passive: true, once: true })
    }

    // The ring's 2s only starts once the row is actually on screen, so an
    // arrival that scrolls late isn't announced to an empty viewport.
    const startRing = () => {
      ringStarted = true
      setRingVisible(true)
      ringTimer = setTimeout(() => setRingVisible(false), HIGHLIGHT_RING_MS)
    }

    const settle = () => {
      if (!abandoned) {
        // 'instant', not 'smooth': the scroll restoration cancels a smooth
        // scroll outright, where an instant one only needs re-applying.
        row.scrollIntoView({ behavior: 'instant', block: 'center' })
      }
      if (!ringStarted && (abandoned || isInViewport(row))) startRing()
      framesLeft -= 1
      if (framesLeft > 0) {
        frame = requestAnimationFrame(settle)
        return
      }
      // Never confirmed in view (a scroller that can't reach it, say) — show
      // the ring anyway rather than swallow the only arrival cue.
      if (!ringStarted) startRing()
    }

    frame = requestAnimationFrame(settle)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(ringTimer)
      for (const name of userScrollEvents) {
        window.removeEventListener(name, abandon)
      }
      setRingVisible(false)
    }
  }, [isHighlighted, isoform.id])

  return (
    <>
      <TableRow
        id={`isoform-row-${isoform.id}`}
        className={cn(
          'group/row cursor-pointer transition-shadow duration-1000',
          ringVisible && 'ring-2 ring-primary ring-inset',
        )}
        onClick={() => onToggleExpanded(isoform.id)}
      >
        <TableCell className="p-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpanded(isoform.id)
            }}
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-expanded={isExpanded}
            aria-controls={
              isExpanded ? `isoform-row-${isoform.id}-details` : undefined
            }
            aria-label={
              isExpanded
                ? copy.collapseRowAria(isoform.id)
                : copy.expandRowAria(isoform.id)
            }
          >
            {isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        </TableCell>
        <TableCell className="font-mono">{isoform.id}</TableCell>
        <TableCell className="font-mono whitespace-nowrap tabular-nums">
          {isoform.codingSequenceLength.toLocaleString()}{' '}
          <span className="text-xs text-muted-foreground">bp</span>
        </TableCell>
        <TableCell className="hidden font-mono whitespace-nowrap tabular-nums sm:table-cell">
          {isoform.proteinSequenceLength.toLocaleString()}{' '}
          <span className="text-xs text-muted-foreground">aa</span>
        </TableCell>
        <TableCell className="hidden font-mono tabular-nums sm:table-cell">
          {gcPercent.toFixed(1)}%
        </TableCell>
        <TableCell className="hidden font-mono tabular-nums lg:table-cell">
          {cpgCount.toLocaleString()}
        </TableCell>
        <TableCell className="hidden font-mono tabular-nums lg:table-cell">
          {wggwCount.toLocaleString()}
        </TableCell>
        <TableCell>
          {/* Phones get the short form ("2×") so the column fits beside the
              transcript id; the tier's name stays in the accessible name. */}
          <Badge className={cn('text-xs', suitConfig.badgeClass)}>
            <span className="sm:hidden" aria-hidden>
              {suitConfig.short}
            </span>
            <span className="sr-only sm:hidden">{suitConfig.label}</span>
            <span className="hidden sm:inline">{suitConfig.label}</span>
          </Badge>
        </TableCell>
        <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {/* Quick actions appear on row hover or keyboard focus (and stay
                on the expanded or linked row) instead of repeating two labels
                on every row. They're icon buttons with tooltips so the column
                stays narrow; the labeled versions live in the menu and in the
                expanded row. Coarse pointers can't hover and phones have no
                room, so there they use the menu. */}
            {quickActionTip && (
              <div
                className={cn(
                  'flex items-center gap-0.5 transition-opacity duration-150',
                  'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100',
                  (isExpanded || ringVisible) && 'opacity-100',
                )}
              >
                {/* No quick action at all for a triple-AAV isoform: there is
                    no ZIP to offer it. The menu and the expanded row say why. */}
                {zipAvailable && (
                  <TooltipTrigger
                    handle={quickActionTip}
                    payload={copy.downloadLong}
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        nativeButton={false}
                        render={
                          <a
                            href={preOptimizedZipUrl(isoform.id)}
                            download={`${isoform.id}_v1.0.zip`}
                            aria-label={copy.downloadAria(isoform.id)}
                          />
                        }
                      />
                    }
                  >
                    <PackageOpen className="size-4" />
                  </TooltipTrigger>
                )}
                <TooltipTrigger
                  handle={quickActionTip}
                  payload={copy.customizeLong}
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      nativeButton={false}
                      render={
                        <Link
                          to="/design-tool"
                          search={{ isoform: isoform.id }}
                          aria-label={copy.customizeAria(isoform.id)}
                        />
                      }
                    />
                  }
                >
                  <WandSparkles className="size-4" />
                </TooltipTrigger>
              </div>
            )}
            <DropdownMenuTrigger
              handle={rowMenu}
              payload={isoform}
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={copy.moreAria(isoform.id)}
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
          </div>
        </TableCell>
      </TableRow>

      {/* Mounted only while expanded: a collapsed panel kept in the DOM left
          its buttons in the tab order and its width in the table's. */}
      {isExpanded && (
        <TableRow id={`isoform-row-${isoform.id}-details`}>
          {/* TableCell defaults to nowrap; the hints here need to wrap. */}
          <TableCell
            colSpan={COLUMN_COUNT}
            className="bg-muted/30 px-3 py-4 whitespace-normal sm:px-6"
          >
            <div className="duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">
              <ExpandedDetails isoform={isoform} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

/** The row's "more" menu, rendered once for the table by the shared root. */
function IsoformMenuContent({
  isoform,
  geneSymbol,
  copyText,
}: {
  isoform: IsoformRowData
  geneSymbol: string
  copyText: (
    text: string,
    id?: string,
    options?: { successMessage?: string },
  ) => void
}) {
  return (
    <DropdownMenuContent align="end">
      {/* Which isoform this menu acts on. On a phone the menu opens over its
          own row and leaves the row above it showing, so six unattributed
          items read as if they belonged to the wrong transcript. Base UI
          wants its label inside a group. */}
      <DropdownMenuGroup>
        <DropdownMenuLabel className="font-mono">
          {isoform.id}
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      {hasPreOptimizedZip(isoform.suitability) ? (
        <DropdownMenuItem
          render={
            <a
              href={preOptimizedZipUrl(isoform.id)}
              download={`${isoform.id}_v1.0.zip`}
            >
              <PackageOpen className="size-4" />
              {copy.downloadLong}
            </a>
          }
        />
      ) : (
        // Disabled rather than dropped, with the reason: the action is offered
        // on every other row, so its absence would otherwise read as a bug.
        <DropdownMenuItem
          disabled
          className="max-w-72 flex-col items-start gap-0.5 whitespace-normal"
        >
          <span className="flex items-center gap-2">
            <PackageOpen className="size-4" />
            {copy.downloadUnavailable}
          </span>
          <span className="type-micro text-muted-foreground">
            {copy.downloadUnavailableReason}
          </span>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        render={<Link to="/design-tool" search={{ isoform: isoform.id }} />}
      >
        <WandSparkles className="size-4" />
        {copy.customizeLong}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() =>
          copyText(isoform.codingSequence, `cds-${isoform.id}`, {
            successMessage: copy.copiedCds(isoform.id),
          })
        }
      >
        <Copy className="size-4" />
        {copy.copyCds}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() =>
          copyText(
            buildIsoformFasta(geneSymbol, isoform),
            `fasta-${isoform.id}`,
            { successMessage: copy.copiedFasta(isoform.id) },
          )
        }
      >
        <FileText className="size-4" />
        {copy.copyFasta}
      </DropdownMenuItem>
      <DropdownMenuItem
        aria-label={copy.downloadFastaAria(isoform.id)}
        onClick={() => {
          downloadTextFile(
            isoformFastaFilename(geneSymbol, isoform.id),
            buildIsoformFasta(geneSymbol, isoform),
          )
        }}
      >
        <Download className="size-4" />
        {copy.downloadFasta}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        render={
          <a
            href={`https://ensembl.org/id/${isoform.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="size-4" />
            {copy.viewEnsembl}
          </a>
        }
      />
    </DropdownMenuContent>
  )
}

function ExpandedDetails({ isoform }: { isoform: IsoformRowData }) {
  const { gcPercent, cpgCount, wggwCount } = isoform
  const zipAvailable = hasPreOptimizedZip(isoform.suitability)
  // The preview only ever proposes a *two-way* split, so it belongs to the
  // dual-AAV tier alone. Showing it for a triple-AAV sequence called a
  // two-vector split "best (balanced)" right above its own "over limit" lines.
  const needsSplit = isoform.suitability === 'dual-aav'

  return (
    <div className="space-y-4">
      {/* The expanded row is where the two main actions are explained, so the
          collapsed rows can stay quiet. Labeled on every screen size. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
        <div className="flex flex-col items-start gap-1.5 sm:max-w-xs">
          <Button
            size="sm"
            nativeButton={false}
            render={
              <Link
                to="/design-tool"
                search={{ isoform: isoform.id }}
                aria-label={copy.customizeAria(isoform.id)}
              />
            }
          >
            <WandSparkles className="size-4" />
            {copy.customizeLong}
          </Button>
          <p className="text-xs text-muted-foreground">{copy.customizeHint}</p>
        </div>
        {zipAvailable ? (
          <div className="flex flex-col items-start gap-1.5 sm:max-w-xs">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={preOptimizedZipUrl(isoform.id)}
                  download={`${isoform.id}_v1.0.zip`}
                  aria-label={copy.downloadAria(isoform.id)}
                >
                  <PackageOpen className="size-4" />
                  {copy.downloadLong}
                </a>
              }
            />
            <p className="text-xs text-muted-foreground">{copy.downloadHint}</p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-2xl border border-dashed px-3 py-2 sm:max-w-xs">
            <PackageOpen
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="space-y-0.5">
              <p className="text-xs font-medium">{copy.downloadUnavailable}</p>
              <p className="text-xs text-muted-foreground">
                {copy.downloadUnavailableReason}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Each dropped column carries the header's own infotip down with it:
          this list is the only place a phone sees CpG or WGGW, so without
          them those terms had no explanation on a phone at all. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:hidden">
        <div>
          <dt className="text-muted-foreground">Protein</dt>
          <dd className="font-mono tabular-nums">
            {isoform.proteinSequenceLength.toLocaleString()} aa
          </dd>
        </div>
        <div>
          <MetricTerm term={terms.gc} />
          <dd className="font-mono tabular-nums">{gcPercent.toFixed(1)}%</dd>
        </div>
        <div>
          <MetricTerm term={terms.cpg} />
          <dd className="font-mono tabular-nums">
            {cpgCount.toLocaleString()}
          </dd>
        </div>
        <div>
          <MetricTerm term={terms.wggw} />
          <dd className="font-mono tabular-nums">
            {wggwCount.toLocaleString()}
          </dd>
        </div>
      </dl>
      {/* AAV fit is not repeated here: its column is on every screen size. */}
      <dl className="hidden grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid md:hidden">
        <div>
          <MetricTerm term={terms.cpg} />
          <dd className="font-mono tabular-nums">
            {cpgCount.toLocaleString()}
          </dd>
        </div>
        <div>
          <MetricTerm term={terms.wggw} />
          <dd className="font-mono tabular-nums">
            {wggwCount.toLocaleString()}
          </dd>
        </div>
      </dl>

      <IsoformValidationBadges codingSequence={isoform.codingSequence} />

      {needsSplit && (
        <IsoformSplitPreview
          codingSequence={isoform.codingSequence}
          codingSequenceLength={isoform.codingSequenceLength}
        />
      )}
    </div>
  )
}

/**
 * A dropped column's label in the expanded row, with the same infotip its
 * header carries. The label is the header's, so the two cannot drift apart.
 */
function MetricTerm({ term }: { term: { label: string; hint: string } }) {
  return (
    <dt className="flex items-center gap-0.5 text-muted-foreground">
      {term.label}
      <TermHint topic={term.label} hint={term.hint} />
    </dt>
  )
}

function SortableHead({
  label,
  hint,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: React.ReactNode
  /** Plain-language explanation of a domain term, shown next to the label. */
  hint?: string
  sortKey: IsoformSortKey
  sort: IsoformSort
  onSort: (key: IsoformSortKey) => void
  className?: string
}) {
  return (
    <TableHead
      className={cn('whitespace-nowrap', className)}
      aria-sort={ariaSortFor(sort, sortKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        <SortButton
          label={label}
          isActive={sort.key === sortKey}
          direction={sort.dir}
          onClick={() => onSort(sortKey)}
        />
        {hint && typeof label === 'string' && (
          <TermHint topic={label} hint={hint} />
        )}
      </span>
    </TableHead>
  )
}

function SortButton({
  label,
  isActive,
  direction,
  onClick,
}: {
  label: React.ReactNode
  isActive: boolean
  direction: IsoformSort['dir']
  onClick: () => void
}) {
  return (
    // py-2 with -my-2: a 36px tap target in the same 20px of layout.
    <button
      type="button"
      className="-my-2 inline-flex min-h-9 items-center gap-1 rounded-sm py-2 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onClick}
    >
      {label}
      {isActive ? (
        direction === 'asc' ? (
          <ArrowUp className="size-3.5" aria-hidden />
        ) : (
          <ArrowDown className="size-3.5" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="size-3.5 text-muted-foreground" aria-hidden />
      )}
    </button>
  )
}

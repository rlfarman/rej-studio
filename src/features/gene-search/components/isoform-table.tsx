'use client'
import { useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { formatFasta } from '@/lib/bio/fasta'
import { downloadTextFile } from '@/lib/download-file'
import { trackEvent } from '@/lib/analytics'
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
import { TermHint } from './term-hint'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'
import {
  ariaSortFor,
  nextIsoformSort,
  parseIsoformSort,
  sortIsoforms,
  withIsoformSort,
  type IsoformSort,
  type IsoformSortKey,
} from '@/features/gene-search/utils/isoform-sort'
import { geneSearchCopy } from '../copy'
import { Skeleton } from '@/components/ui/skeleton'

const copy = geneSearchCopy.isoformTable
const terms = geneSearchCopy.terms

/** Pre-optimized sequence package for an isoform (static, built offline). */
function preOptimizedZipUrl(isoformId: string) {
  return `https://rej-seq-1.s3.us-west-004.backblazeb2.com/rej/v1.0/zips/${isoformId}_v1.0.zip`
}

interface IsoformListProps {
  isoforms: IsoformListItem[]
  highlightedIsoformId?: string
}

const COLUMN_COUNT = 9

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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sort = parseIsoformSort(new URLSearchParams(searchParams.toString()))
  const { copy: copyText, isCopied } = useCopyToClipboard({
    showToast: false,
  })

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    highlightedIsoformId ? new Set([highlightedIsoformId]) : new Set(),
  )

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

  // replaceState, not router.replace: Next syncs useSearchParams with it and
  // skips the server round trip, since the table sorts on the client.
  const toggleSort = (key: IsoformSortKey) => {
    const params = withIsoformSort(
      new URLSearchParams(searchParams.toString()),
      nextIsoformSort(sort, key),
    )
    const qs = params.toString()
    window.history.replaceState(
      null,
      '',
      `${pathname}${qs ? `?${qs}` : ''}${window.location.hash}`,
    )
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
      <p className="text-muted-foreground py-8 text-center text-sm">
        {copy.empty}
      </p>
    )
  }

  const sortProps = { sort, onSort: toggleSort }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-11 min-w-11 p-0">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={toggleExpandAll}
                      aria-expanded={allExpanded}
                      className="hover:text-foreground focus-visible:ring-ring text-muted-foreground flex h-full w-full items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
            <SortableHead
              label={terms.suitability.label}
              hint={terms.suitability.hint}
              sortKey="suitability"
              {...sortProps}
              className="hidden lg:table-cell"
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
              gcPercent={row.gcPercent}
              cpgCount={row.cpgCount}
              wggwCount={row.wggwCount}
              suitConfig={getSuitabilityConfig(row.suitability)}
              cdsId={`cds-${row.id}`}
              fastaId={`fasta-${row.id}`}
              isCopied={isCopied}
              copyText={copyText}
              onToggleExpanded={toggleExpanded}
            />
          ))}
        </TableBody>
      </Table>
    </>
  )
}

function IsoformRow({
  isoform,
  isExpanded,
  isHighlighted,
  gcPercent,
  cpgCount,
  wggwCount,
  suitConfig,
  cdsId,
  fastaId,
  isCopied,
  copyText,
  onToggleExpanded,
}: {
  isoform: IsoformListItem
  isExpanded: boolean
  isHighlighted?: boolean
  gcPercent: number
  cpgCount: number
  wggwCount: number
  suitConfig: ReturnType<typeof getSuitabilityConfig>
  cdsId: string
  fastaId: string
  isCopied: (id: string) => boolean
  copyText: (text: string, id: string) => void
  onToggleExpanded: (id: string) => void
}) {
  const [ringVisible, setRingVisible] = useState(!!isHighlighted)

  useEffect(() => {
    if (!isHighlighted) return
    // Intentional: triggers the highlight ring animation when isHighlighted changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRingVisible(true)
    document
      .getElementById(`isoform-row-${isoform.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setRingVisible(false), 2000)
    return () => clearTimeout(timer)
  }, [isHighlighted, isoform.id])

  return (
    <>
      <TableRow
        id={`isoform-row-${isoform.id}`}
        className={cn(
          'group/row cursor-pointer transition-shadow duration-1000',
          ringVisible && 'ring-primary ring-2 ring-inset',
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
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
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
          <span className="text-muted-foreground text-xs">bp</span>
        </TableCell>
        <TableCell className="hidden font-mono whitespace-nowrap tabular-nums sm:table-cell">
          {isoform.proteinSequenceLength.toLocaleString()}{' '}
          <span className="text-muted-foreground text-xs">aa</span>
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
        <TableCell className="hidden lg:table-cell">
          <Badge className={cn('text-xs', suitConfig.badgeClass)}>
            {suitConfig.label}
          </Badge>
        </TableCell>
        <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {/* Quick actions appear on row hover or keyboard focus (and stay
                on the expanded or linked row) instead of repeating two labels
                on every row. They're icon buttons with tooltips so the column
                stays narrow; the labeled versions live in the menu and in the
                expanded row. Coarse pointers can't hover, so they use the
                menu. */}
            <div
              className={cn(
                'hidden items-center gap-0.5 transition-opacity duration-150 sm:flex pointer-coarse:hidden',
                'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100',
                (isExpanded || ringVisible) && 'opacity-100',
              )}
            >
              <Tooltip>
                <TooltipTrigger
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
                          onClick={() =>
                            trackEvent({
                              event: 'precomputed_download',
                              isoform_id: isoform.id,
                            })
                          }
                        />
                      }
                    />
                  }
                >
                  <PackageOpen className="size-4" />
                </TooltipTrigger>
                <TooltipContent>{copy.downloadLong}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      nativeButton={false}
                      render={
                        <Link
                          href={`/design-tool?isoform=${isoform.id}`}
                          aria-label={copy.customizeAria(isoform.id)}
                        />
                      }
                    />
                  }
                >
                  <WandSparkles className="size-4" />
                </TooltipTrigger>
                <TooltipContent>{copy.customizeLong}</TooltipContent>
              </Tooltip>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
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
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  render={
                    <a
                      href={preOptimizedZipUrl(isoform.id)}
                      download={`${isoform.id}_v1.0.zip`}
                      onClick={() =>
                        trackEvent({
                          event: 'precomputed_download',
                          isoform_id: isoform.id,
                        })
                      }
                    >
                      <PackageOpen className="size-4" />
                      {copy.downloadLong}
                    </a>
                  }
                />
                <DropdownMenuItem
                  render={<Link href={`/design-tool?isoform=${isoform.id}`} />}
                >
                  <WandSparkles className="size-4" />
                  {copy.customizeLong}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => copyText(isoform.codingSequence, cdsId)}
                >
                  <Copy className="size-4" />
                  {isCopied(cdsId) ? copy.copied : copy.copyCds}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    copyText(
                      formatFasta(isoform.id, isoform.codingSequence),
                      fastaId,
                    )
                  }
                >
                  <FileText className="size-4" />
                  {isCopied(fastaId) ? copy.copied : copy.copyFasta}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    downloadTextFile(
                      `${isoform.id}.fasta`,
                      formatFasta(isoform.id, isoform.codingSequence),
                    )
                    trackEvent({
                      event: 'sequence_download',
                      isoform_id: isoform.id,
                    })
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
            </DropdownMenu>
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
            <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 duration-200">
              <ExpandedDetails
                isoform={isoform}
                gcPercent={gcPercent}
                cpgCount={cpgCount}
                wggwCount={wggwCount}
                suitConfig={suitConfig}
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function ExpandedDetails({
  isoform,
  gcPercent,
  cpgCount,
  wggwCount,
  suitConfig,
}: {
  isoform: IsoformListItem
  gcPercent: number
  cpgCount: number
  wggwCount: number
  suitConfig: ReturnType<typeof getSuitabilityConfig>
}) {
  const needsSplit = isoform.codingSequenceLength > 4700

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
                href={`/design-tool?isoform=${isoform.id}`}
                aria-label={copy.customizeAria(isoform.id)}
              />
            }
          >
            <WandSparkles className="size-4" />
            {copy.customizeLong}
          </Button>
          <p className="text-muted-foreground text-xs">{copy.customizeHint}</p>
        </div>
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
                onClick={() =>
                  trackEvent({
                    event: 'precomputed_download',
                    isoform_id: isoform.id,
                  })
                }
              >
                <PackageOpen className="size-4" />
                {copy.downloadLong}
              </a>
            }
          />
          <p className="text-muted-foreground text-xs">{copy.downloadHint}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:hidden">
        <div>
          <dt className="text-muted-foreground">Protein</dt>
          <dd className="font-mono tabular-nums">
            {isoform.proteinSequenceLength.toLocaleString()} aa
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">GC</dt>
          <dd className="font-mono tabular-nums">{gcPercent.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">CpG</dt>
          <dd className="font-mono tabular-nums">
            {cpgCount.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">WGGW</dt>
          <dd className="font-mono tabular-nums">
            {wggwCount.toLocaleString()}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">{terms.suitability.label}</dt>
          <dd>
            <Badge className={cn('text-xs', suitConfig.badgeClass)}>
              {suitConfig.label}
            </Badge>
          </dd>
        </div>
      </dl>
      <dl className="hidden grid-cols-3 gap-x-4 gap-y-2 text-xs sm:grid md:hidden">
        <div>
          <dt className="text-muted-foreground">CpG</dt>
          <dd className="font-mono tabular-nums">
            {cpgCount.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">WGGW</dt>
          <dd className="font-mono tabular-nums">
            {wggwCount.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{terms.suitability.label}</dt>
          <dd>
            <Badge className={cn('text-xs', suitConfig.badgeClass)}>
              {suitConfig.label}
            </Badge>
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
          <TermHint label={terms.termAria(label)} hint={hint} />
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
      className="hover:text-foreground focus-visible:ring-ring -my-2 inline-flex min-h-9 items-center gap-1 rounded-sm py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
        <ArrowUpDown className="text-muted-foreground size-3.5" aria-hidden />
      )}
    </button>
  )
}

const SKELETON_ROWS = 5

/**
 * Stands in for the summary line and the table at roughly their real size,
 * so the page doesn't jump when the isoforms arrive.
 */
export function IsoformTableLoading() {
  return (
    <div
      role="status"
      aria-label={copy.loadingAria}
      className="flex flex-col gap-3"
    >
      <div className="flex h-8 items-center gap-6" aria-hidden>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="hidden h-4 w-40 sm:block" />
      </div>
      <div aria-hidden>
        <div className="flex h-10 items-center gap-4 border-b px-2">
          <Skeleton className="h-3.5 w-7" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="hidden h-3.5 w-16 sm:block" />
          <Skeleton className="hidden h-3.5 w-12 sm:block" />
        </div>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-4 border-b px-2 last:border-0"
          >
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden h-4 w-16 sm:block" />
            <Skeleton className="hidden h-4 w-12 sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}

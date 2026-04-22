'use client'
import { useMemo, useState, useCallback, useEffect } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SpeciesSelect } from '@/components/bio/species-select'
import { useSpeciesContext } from '@/stores/species-store'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { formatFasta } from '@/lib/bio/fasta'
import { downloadTextFile } from '@/lib/download-file'
import { trackEvent } from '@/lib/analytics'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from '@/lib/bio/design-suitability'
import {
  computeGcPercent,
  countCpG,
  rankWggwByBalance,
} from '@/lib/bio/sequence-utils'
import { IsoformValidationBadges } from './isoform-validation-badges'
import { IsoformSplitPreview } from './isoform-split-preview'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'

interface IsoformListProps {
  isoforms: IsoformListItem[]
  highlightedIsoformId?: string
}

type SortKey =
  | 'enst'
  | 'cdsLength'
  | 'proteinLength'
  | 'gcPercent'
  | 'cpg'
  | 'wggw'
  | 'suitability'
type SortDirection = 'asc' | 'desc'

const COLUMN_COUNT = 9

const SUITABILITY_RANK = {
  'single-aav': 0,
  'dual-aav': 1,
  'triple-aav': 2,
} as const

export default function IsoformTable({
  isoforms,
  highlightedIsoformId,
}: IsoformListProps) {
  const { species } = useSpeciesContext()
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })

  const [sortKey, setSortKey] = useState<SortKey>('cdsLength')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    highlightedIsoformId ? new Set([highlightedIsoformId]) : new Set(),
  )

  const filteredIsoforms = useMemo(
    () =>
      isoforms.filter((isoform) => {
        if (!species || species === 'both') return true
        return isoform.species.toLowerCase() === species
      }),
    [species, isoforms],
  )

  // Pre-compute per-isoform metrics once per filtered set. Previously, sorting
  // by GC/CpG/WGGW/suitability ran O(n log n) calls to the sequence scanners
  // on every sort; now each metric is computed exactly once per isoform.
  const metrics = useMemo(() => {
    const map = new Map<
      string,
      {
        gcPercent: number
        cpgCount: number
        wggwCount: number
        suitability: ReturnType<typeof assessDesignSuitability>
        suitConfig: ReturnType<typeof getSuitabilityConfig>
      }
    >()
    for (const isoform of filteredIsoforms) {
      const upperSeq = isoform.codingSequence.toUpperCase()
      const suitability = assessDesignSuitability(isoform.codingSequence)
      map.set(isoform.id, {
        gcPercent: computeGcPercent(upperSeq),
        cpgCount: countCpG(upperSeq),
        wggwCount: rankWggwByBalance(upperSeq).length,
        suitability,
        suitConfig: getSuitabilityConfig(suitability),
      })
    }
    return map
  }, [filteredIsoforms])

  const sortedIsoforms = useMemo(() => {
    const sorted = [...filteredIsoforms]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'enst':
          cmp = a.id.localeCompare(b.id)
          break
        case 'cdsLength':
          cmp = a.codingSequenceLength - b.codingSequenceLength
          break
        case 'proteinLength':
          cmp = a.proteinSequenceLength - b.proteinSequenceLength
          break
        case 'gcPercent':
          cmp = metrics.get(a.id)!.gcPercent - metrics.get(b.id)!.gcPercent
          break
        case 'cpg':
          cmp = metrics.get(a.id)!.cpgCount - metrics.get(b.id)!.cpgCount
          break
        case 'wggw':
          cmp = metrics.get(a.id)!.wggwCount - metrics.get(b.id)!.wggwCount
          break
        case 'suitability':
          cmp =
            SUITABILITY_RANK[metrics.get(a.id)!.suitability] -
            SUITABILITY_RANK[metrics.get(b.id)!.suitability]
          break
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [filteredIsoforms, metrics, sortKey, sortDirection])

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDirection('asc')
      }
    },
    [sortKey],
  )

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleExpandAll = useCallback(() => {
    setExpandedIds((prev) => {
      const allIds = filteredIsoforms.map((i) => i.id)
      const allExpanded = allIds.every((id) => prev.has(id))
      return allExpanded ? new Set() : new Set(allIds)
    })
  }, [filteredIsoforms])

  const allExpanded =
    filteredIsoforms.length > 0 &&
    filteredIsoforms.every((i) => expandedIds.has(i.id))

  if (filteredIsoforms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-muted-foreground max-w-lg text-sm">
          No isoforms available for this species. Try selecting a different
          species filter.
        </p>
        <SpeciesSelect alwaysShowLabel />
      </div>
    )
  }

  return (
    <>
      <Table data-tour="isoform-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-11 min-w-11 p-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleExpandAll}
                    aria-expanded={allExpanded}
                    className="hover:text-foreground focus-visible:ring-ring text-muted-foreground flex h-full w-full items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    aria-label={
                      allExpanded
                        ? 'Collapse all isoforms'
                        : 'Expand all isoforms'
                    }
                  >
                    {allExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {allExpanded ? 'Collapse all' : 'Expand all'}
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
              currentKey={sortKey}
              direction={sortDirection}
              onSort={toggleSort}
            />
            <SortableHead
              label="CDS"
              sortKey="cdsLength"
              currentKey={sortKey}
              direction={sortDirection}
              onSort={toggleSort}
            />
            <SortableHead
              label="Protein"
              sortKey="proteinLength"
              currentKey={sortKey}
              direction={sortDirection}
              onSort={toggleSort}
              className="hidden sm:table-cell"
            />
            <SortableHead
              label="GC %"
              sortKey="gcPercent"
              currentKey={sortKey}
              direction={sortDirection}
              onSort={toggleSort}
              className="hidden sm:table-cell"
            />
            <SortableHead
              label="CpG"
              sortKey="cpg"
              currentKey={sortKey}
              direction={sortDirection}
              onSort={toggleSort}
              className="hidden lg:table-cell"
            />
            <SortableHead
              label="WGGW"
              sortKey="wggw"
              currentKey={sortKey}
              direction={sortDirection}
              onSort={toggleSort}
              className="hidden lg:table-cell"
            />
            <SortableHead
              label="Suitability"
              sortKey="suitability"
              currentKey={sortKey}
              direction={sortDirection}
              onSort={toggleSort}
              className="hidden lg:table-cell"
            />
            <TableHead className="w-auto sm:w-28">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedIsoforms.map((isoform) => {
            const isExpanded = expandedIds.has(isoform.id)
            const m = metrics.get(isoform.id)!
            const cdsId = `cds-${isoform.id}`
            const fastaId = `fasta-${isoform.id}`

            return (
              <IsoformRow
                key={isoform.id}
                isoform={isoform}
                isExpanded={isExpanded}
                isHighlighted={isoform.id === highlightedIsoformId}
                gcPercent={m.gcPercent}
                cpgCount={m.cpgCount}
                wggwCount={m.wggwCount}
                suitability={m.suitability}
                suitConfig={m.suitConfig}
                cdsId={cdsId}
                fastaId={fastaId}
                isCopied={isCopied}
                copy={copy}
                onToggleExpanded={toggleExpanded}
              />
            )
          })}
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
  suitability,
  suitConfig,
  cdsId,
  fastaId,
  isCopied,
  copy,
  onToggleExpanded,
}: {
  isoform: IsoformListItem
  isExpanded: boolean
  isHighlighted?: boolean
  gcPercent: number
  cpgCount: number
  wggwCount: number
  suitability: ReturnType<typeof assessDesignSuitability>
  suitConfig: ReturnType<typeof getSuitabilityConfig>
  cdsId: string
  fastaId: string
  isCopied: (id: string) => boolean
  copy: (text: string, id: string) => void
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
          'cursor-pointer transition-shadow duration-1000',
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
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
            aria-expanded={isExpanded}
            aria-controls={`isoform-row-${isoform.id}-details`}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${isoform.id} details`}
          >
            {isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        </TableCell>
        <TableCell className="font-mono">{isoform.id}</TableCell>
        <TableCell className="font-mono tabular-nums">
          {isoform.codingSequenceLength.toLocaleString()}{' '}
          <span className="text-muted-foreground text-xs">bp</span>
        </TableCell>
        <TableCell className="hidden font-mono tabular-nums sm:table-cell">
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
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div
            className="flex items-center justify-end gap-1"
            data-tour="isoform-actions"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden size-8 sm:inline-flex"
                  disabled
                  aria-label={`Download precomputed for ${isoform.id}`}
                >
                  <PackageOpen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download precomputed</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" asChild>
                  <Link
                    href={`/design-tool?isoform=${isoform.id}`}
                    aria-label={`Customize ${isoform.id} in design tool`}
                  >
                    <ExternalLink className="size-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Customize</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Actions for ${isoform.id}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => copy(isoform.codingSequence, cdsId)}
                >
                  <Copy className="size-4" />
                  {isCopied(cdsId) ? 'Copied!' : 'Copy CDS'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    copy(
                      formatFasta(isoform.id, isoform.codingSequence),
                      fastaId,
                    )
                  }
                >
                  <FileText className="size-4" />
                  {isCopied(fastaId) ? 'Copied!' : 'Copy FASTA'}
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
                  Download FASTA
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a
                    href={`https://ensembl.org/id/${isoform.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    View on Ensembl
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <TableRow id={`isoform-row-${isoform.id}-details`}>
        <TableCell colSpan={COLUMN_COUNT} className="p-0">
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-300 ease-out',
              isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div className="bg-muted/30 px-6 py-4">
                <ExpandedDetails
                  isoform={isoform}
                  gcPercent={gcPercent}
                  cpgCount={cpgCount}
                  wggwCount={wggwCount}
                  suitability={suitability}
                  suitConfig={suitConfig}
                />
              </div>
            </div>
          </div>
        </TableCell>
      </TableRow>
    </>
  )
}

function ExpandedDetails({
  isoform,
  gcPercent,
  cpgCount,
  wggwCount,
  suitability,
  suitConfig,
}: {
  isoform: IsoformListItem
  gcPercent: number
  cpgCount: number
  wggwCount: number
  suitability: ReturnType<typeof assessDesignSuitability>
  suitConfig: ReturnType<typeof getSuitabilityConfig>
}) {
  const needsSplit = isoform.codingSequenceLength > 4700

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:hidden sm:grid-cols-3">
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
          <dt className="text-muted-foreground">Suitability</dt>
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
          <dt className="text-muted-foreground">Suitability</dt>
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
  sortKey,
  currentKey,
  direction,
  onSort,
  className,
}: {
  label: React.ReactNode
  sortKey: SortKey
  currentKey: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = currentKey === sortKey

  return (
    <TableHead className={className}>
      <button
        type="button"
        className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="text-muted-foreground size-3.5" />
        )}
      </button>
    </TableHead>
  )
}

export function IsoformTableLoading() {
  return (
    <p className="text-muted-foreground px-2 py-4 text-sm" aria-live="polite">
      Loading isoforms…
    </p>
  )
}

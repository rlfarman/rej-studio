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

const SUITABILITY_VARIANT_MAP = {
  'single-aav': 'default',
  'dual-aav': 'secondary',
  'triple-aav': 'destructive',
} as const

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

  const sortedIsoforms = useMemo(() => {
    const sorted = [...filteredIsoforms]
    sorted.sort((a, b) => {
      let cmp = 0
      const seqA = a.codingSequence.toUpperCase()
      const seqB = b.codingSequence.toUpperCase()
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
          cmp = computeGcPercent(seqA) - computeGcPercent(seqB)
          break
        case 'cpg':
          cmp = countCpG(seqA) - countCpG(seqB)
          break
        case 'wggw':
          cmp = rankWggwByBalance(seqA).length - rankWggwByBalance(seqB).length
          break
        case 'suitability':
          cmp =
            SUITABILITY_RANK[assessDesignSuitability(a.codingSequence)] -
            SUITABILITY_RANK[assessDesignSuitability(b.codingSequence)]
          break
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [filteredIsoforms, sortKey, sortDirection])

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 p-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleExpandAll}
                    className="hover:text-foreground text-muted-foreground flex h-full w-full items-center justify-center transition-colors"
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
              className="hidden md:table-cell"
            />
            <SortableHead
              label="GC %"
              sortKey="gcPercent"
              currentKey={sortKey}
              direction={sortDirection}
              onSort={toggleSort}
              className="hidden md:table-cell"
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
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedIsoforms.map((isoform) => {
            const isExpanded = expandedIds.has(isoform.id)
            const suitability = assessDesignSuitability(isoform.codingSequence)
            const suitConfig = getSuitabilityConfig(suitability)
            const cdsId = `cds-${isoform.id}`
            const fastaId = `fasta-${isoform.id}`

            return (
              <IsoformRow
                key={isoform.id}
                isoform={isoform}
                isExpanded={isExpanded}
                isHighlighted={isoform.id === highlightedIsoformId}
                suitability={suitability}
                suitConfig={suitConfig}
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
  suitability: ReturnType<typeof assessDesignSuitability>
  suitConfig: ReturnType<typeof getSuitabilityConfig>
  cdsId: string
  fastaId: string
  isCopied: (id: string) => boolean
  copy: (text: string, id: string) => void
  onToggleExpanded: (id: string) => void
}) {
  const [ringVisible, setRingVisible] = useState(!!isHighlighted)

  const seq = isoform.codingSequence.toUpperCase()
  const gcPercent = useMemo(() => computeGcPercent(seq), [seq])
  const cpgCount = useMemo(() => countCpG(seq), [seq])
  const wggwCount = useMemo(() => rankWggwByBalance(seq).length, [seq])

  const gcClass =
    gcPercent >= 35 && gcPercent <= 60
      ? 'text-emerald-600 dark:text-emerald-400'
      : gcPercent >= 25 && gcPercent <= 70
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'

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
        <TableCell>
          {isExpanded ? (
            <ChevronDown className="text-muted-foreground size-4" />
          ) : (
            <ChevronRight className="text-muted-foreground size-4" />
          )}
        </TableCell>
        <TableCell className="font-mono">{isoform.id}</TableCell>
        <TableCell className="font-mono tabular-nums">
          {isoform.codingSequenceLength.toLocaleString()}{' '}
          <span className="text-muted-foreground text-xs">bp</span>
        </TableCell>
        <TableCell className="hidden font-mono tabular-nums md:table-cell">
          {isoform.proteinSequenceLength.toLocaleString()}{' '}
          <span className="text-muted-foreground text-xs">aa</span>
        </TableCell>
        <TableCell
          className={cn('hidden font-mono tabular-nums md:table-cell', gcClass)}
        >
          {gcPercent.toFixed(1)}%
        </TableCell>
        <TableCell className="hidden font-mono tabular-nums lg:table-cell">
          {cpgCount.toLocaleString()}
        </TableCell>
        <TableCell className="hidden font-mono tabular-nums lg:table-cell">
          {wggwCount.toLocaleString()}
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <Badge
            variant={SUITABILITY_VARIANT_MAP[suitability]}
            className="text-xs"
          >
            {suitConfig.label}
          </Badge>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
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
                  copy(formatFasta(isoform.id, isoform.codingSequence), fastaId)
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
              <DropdownMenuItem disabled>
                <PackageOpen className="size-4" />
                Download precomputed
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/design-tool?isoform=${isoform.id}`}>
                  <ExternalLink className="size-4" />
                  Customize
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT} className="bg-muted/30 px-6 py-4">
            <ExpandedDetails isoform={isoform} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function ExpandedDetails({ isoform }: { isoform: IsoformListItem }) {
  const needsSplit = isoform.codingSequenceLength > 4700

  return (
    <div className="space-y-4">
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
        className="hover:text-foreground inline-flex items-center gap-1"
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>
            <span className="hidden sm:inline">Ensembl Transcript ID</span>
            <span className="sm:hidden">ENST</span>
          </TableHead>
          <TableHead>CDS</TableHead>
          <TableHead className="hidden md:table-cell">Protein</TableHead>
          <TableHead className="hidden md:table-cell">GC %</TableHead>
          <TableHead className="hidden lg:table-cell">CpG</TableHead>
          <TableHead className="hidden lg:table-cell">WGGW</TableHead>
          <TableHead className="hidden lg:table-cell">Suitability</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell
            colSpan={COLUMN_COUNT}
            className="text-muted-foreground text-center"
          >
            Loading isoforms...
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

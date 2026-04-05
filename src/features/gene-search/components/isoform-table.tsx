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
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { SpeciesSelect } from '@/components/bio/species-select'
import { useSpeciesContext } from '@/stores/species-store'
import { SPECIES_DISPLAY_NAME } from '@/lib/bio/species'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { formatFasta } from '@/lib/bio/fasta'
import { downloadTextFile } from '@/lib/download-file'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from '@/lib/bio/design-suitability'
import { IsoformValidationBadges } from './isoform-validation-badges'
import { IsoformMetricsStrip } from './isoform-metrics-strip'
import { IsoformSplitPreview } from './isoform-split-preview'
import { IsoformComparisonSheet } from './isoform-comparison-sheet'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'

interface IsoformListProps {
  isoforms: IsoformListItem[]
  highlightedIsoformId?: string
}

type SortKey =
  | 'enst'
  | 'cdsLength'
  | 'proteinLength'
  | 'species'
  | 'suitability'
type SortDirection = 'asc' | 'desc'

const SUITABILITY_VARIANT_MAP = {
  'single-aav': 'default',
  'dual-aav': 'secondary',
  'triple-aav': 'destructive',
} as const

const COLUMN_COUNT = 8

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
        case 'species':
          cmp = a.species.localeCompare(b.species)
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

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectedIsoforms = useMemo(
    () => isoforms.filter((i) => selectedIds.has(i.id)),
    [isoforms, selectedIds],
  )

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
            <TableHead className="w-10">
              <span className="sr-only">Select</span>
            </TableHead>
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
              label="Suitability"
              sortKey="suitability"
              currentKey={sortKey}
              direction={sortDirection}
              onSort={toggleSort}
              className="hidden lg:table-cell"
            />
            <TableHead className="hidden md:table-cell">Species</TableHead>
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
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedIsoforms.map((isoform) => {
            const isExpanded = expandedIds.has(isoform.id)
            const isSelected = selectedIds.has(isoform.id)
            const suitability = assessDesignSuitability(isoform.codingSequence)
            const suitConfig = getSuitabilityConfig(suitability)
            const cdsId = `cds-${isoform.id}`
            const fastaId = `fasta-${isoform.id}`

            return (
              <IsoformRow
                key={isoform.id}
                isoform={isoform}
                isExpanded={isExpanded}
                isSelected={isSelected}
                isHighlighted={isoform.id === highlightedIsoformId}
                suitability={suitability}
                suitConfig={suitConfig}
                cdsId={cdsId}
                fastaId={fastaId}
                isCopied={isCopied}
                copy={copy}
                onToggleExpanded={toggleExpanded}
                onToggleSelected={toggleSelected}
              />
            )
          })}
        </TableBody>
      </Table>

      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-10 mt-4 flex justify-center">
          <IsoformComparisonSheet isoforms={selectedIsoforms}>
            <Button size="sm">
              Compare {selectedIds.size} isoform
              {selectedIds.size > 1 ? 's' : ''}
            </Button>
          </IsoformComparisonSheet>
        </div>
      )}
    </>
  )
}

function IsoformRow({
  isoform,
  isExpanded,
  isSelected,
  isHighlighted,
  suitability,
  suitConfig,
  cdsId,
  fastaId,
  isCopied,
  copy,
  onToggleExpanded,
  onToggleSelected,
}: {
  isoform: IsoformListItem
  isExpanded: boolean
  isSelected: boolean
  isHighlighted?: boolean
  suitability: ReturnType<typeof assessDesignSuitability>
  suitConfig: ReturnType<typeof getSuitabilityConfig>
  cdsId: string
  fastaId: string
  isCopied: (id: string) => boolean
  copy: (text: string, id: string) => void
  onToggleExpanded: (id: string) => void
  onToggleSelected: (id: string) => void
}) {
  const [ringVisible, setRingVisible] = useState(!!isHighlighted)

  useEffect(() => {
    if (!isHighlighted) return
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
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelected(isoform.id)}
            aria-label={`Select ${isoform.id}`}
          />
        </TableCell>
        <TableCell>
          {isExpanded ? (
            <ChevronDown className="text-muted-foreground size-4" />
          ) : (
            <ChevronRight className="text-muted-foreground size-4" />
          )}
        </TableCell>
        <TableCell className="font-mono tabular-nums">
          {isoform.codingSequenceLength.toLocaleString()}{' '}
          <span className="text-muted-foreground text-xs">bp</span>
        </TableCell>
        <TableCell className="hidden font-mono tabular-nums md:table-cell">
          {isoform.proteinSequenceLength.toLocaleString()}{' '}
          <span className="text-muted-foreground text-xs">aa</span>
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <Badge
            variant={SUITABILITY_VARIANT_MAP[suitability]}
            className="text-xs"
          >
            {suitConfig.label}
          </Badge>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          {SPECIES_DISPLAY_NAME[
            isoform.species as keyof typeof SPECIES_DISPLAY_NAME
          ] ?? 'Unknown'}
        </TableCell>
        <TableCell className="font-mono">{isoform.id}</TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => copy(isoform.codingSequence, cdsId)}
                  aria-label="Copy CDS"
                >
                  {isCopied(cdsId) ? (
                    <span className="text-xs">OK</span>
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy CDS</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() =>
                    copy(
                      formatFasta(isoform.id, isoform.codingSequence),
                      fastaId,
                    )
                  }
                  aria-label="Copy FASTA"
                >
                  {isCopied(fastaId) ? (
                    <span className="text-xs">OK</span>
                  ) : (
                    <FileText className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy FASTA</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() =>
                    downloadTextFile(
                      `${isoform.id}.fasta`,
                      formatFasta(isoform.id, isoform.codingSequence),
                    )
                  }
                  aria-label="Download FASTA"
                >
                  <Download className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download FASTA</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" asChild>
                  <Link
                    href={`/design-tool?isoform=${isoform.id}`}
                    aria-label={`Customize ${isoform.id}`}
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Customize</TooltipContent>
            </Tooltip>
          </div>
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

      <IsoformMetricsStrip codingSequence={isoform.codingSequence} />

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
          <TableHead className="w-10" />
          <TableHead className="w-8" />
          <TableHead>CDS</TableHead>
          <TableHead className="hidden md:table-cell">Protein</TableHead>
          <TableHead className="hidden lg:table-cell">Suitability</TableHead>
          <TableHead className="hidden md:table-cell">Species</TableHead>
          <TableHead>
            <span className="hidden sm:inline">Ensembl Transcript ID</span>
            <span className="sm:hidden">ENST</span>
          </TableHead>
          <TableHead className="text-right">Actions</TableHead>
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

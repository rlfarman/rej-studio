'use client'
import { useMemo, useState, useCallback } from 'react'
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
  FlaskConical,
  Beaker,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { SpeciesSelect } from '@/components/header/species-select'
import { useSpeciesContext } from '@/context/species-context'
import { SPECIES_DISPLAY_NAME } from '@/lib/species'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { CopyableText } from '@/components/copyable-text'
import { formatFasta } from '@/lib/fasta'
import { downloadTextFile } from '@/lib/download-file'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from '@/lib/design-suitability'
import { IsoformValidationBadges } from './isoform-validation-badges'
import { IsoformComparisonSheet } from './isoform-comparison-sheet'
import type { IsoformListItem } from '@/lib/domain-types'

interface IsoformListProps {
  isoforms: IsoformListItem[]
}

type SortKey = 'enst' | 'cdsLength' | 'proteinLength' | 'species'
type SortDirection = 'asc' | 'desc'

const SUITABILITY_VARIANT_MAP = {
  easy: 'default',
  moderate: 'secondary',
  complex: 'outline',
  oversized: 'destructive',
} as const

const COLUMN_COUNT = 8

export default function IsoformTable({ isoforms }: IsoformListProps) {
  const { species } = useSpeciesContext()
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })

  const [sortKey, setSortKey] = useState<SortKey>('cdsLength')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
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
          cmp = a.enst.localeCompare(b.enst)
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
            <TableHead className="w-8">
              <span className="sr-only">Expand</span>
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
            <TableHead className="hidden lg:table-cell">Suitability</TableHead>
            <TableHead className="hidden md:table-cell">Species</TableHead>
            <SortableHead
              label={
                <>
                  <span className="hidden sm:inline">Ensembl Transcript ID</span>
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
              Compare {selectedIds.size} isoform{selectedIds.size > 1 ? 's' : ''}
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
  suitability: ReturnType<typeof assessDesignSuitability>
  suitConfig: ReturnType<typeof getSuitabilityConfig>
  cdsId: string
  fastaId: string
  isCopied: (id: string) => boolean
  copy: (text: string, id: string) => void
  onToggleExpanded: (id: string) => void
  onToggleSelected: (id: string) => void
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => onToggleExpanded(isoform.id)}>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelected(isoform.id)}
            aria-label={`Select ${isoform.enst}`}
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
        <TableCell className="font-mono">{isoform.enst}</TableCell>
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
                      formatFasta(isoform.enst, isoform.codingSequence),
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
                      `${isoform.enst}.fasta`,
                      formatFasta(isoform.enst, isoform.codingSequence),
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
                    aria-label={`Customize ${isoform.enst}`}
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
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })

  return (
    <div className="space-y-4">
      <IsoformValidationBadges
        codingSequence={isoform.codingSequence}
        codingSequenceLength={isoform.codingSequenceLength}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="text-muted-foreground mb-1 text-xs font-semibold">
            Coding Sequence
          </div>
          <CopyableText
            label="Copy coding sequence"
            copied={isCopied('exp-cds')}
            onCopy={() => copy(isoform.codingSequence, 'exp-cds')}
          >
            <code className="text-xs break-all">
              {isoform.codingSequence.slice(0, 60)}...
            </code>
          </CopyableText>
        </div>
        <div>
          <div className="text-muted-foreground mb-1 text-xs font-semibold">
            Protein Sequence
          </div>
          <CopyableText
            label="Copy protein sequence"
            copied={isCopied('exp-prot')}
            onCopy={() => copy(isoform.proteinSequence, 'exp-prot')}
          >
            <code className="text-xs break-all">
              {isoform.proteinSequence.slice(0, 60)}...
            </code>
          </CopyableText>
        </div>
      </div>

      {(isoform.defaultFivePrimeSequence || isoform.defaultThreePrimeSequence) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isoform.defaultFivePrimeSequence && (
            <div>
              <div className="text-muted-foreground mb-1 text-xs font-semibold">
                Default 5&apos; Fragment
              </div>
              <code className="text-xs break-all">
                {isoform.defaultFivePrimeSequence.slice(0, 40)}...
              </code>
            </div>
          )}
          {isoform.defaultThreePrimeSequence && (
            <div>
              <div className="text-muted-foreground mb-1 text-xs font-semibold">
                Default 3&apos; Fragment
              </div>
              <code className="text-xs break-all">
                {isoform.defaultThreePrimeSequence.slice(0, 40)}...
              </code>
            </div>
          )}
        </div>
      )}

      <Separator />

      <div className="flex flex-wrap gap-2">
        <span className="text-muted-foreground text-xs font-semibold self-center mr-1">
          Design with preset
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/design-tool?isoform=${isoform.id}&preset=balanced`}>
            <Beaker className="size-3.5" />
            Balanced
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/design-tool?isoform=${isoform.id}&preset=aavConstrained`}>
            <FlaskConical className="size-3.5" />
            AAV-Constrained
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/design-tool?isoform=${isoform.id}&preset=lowCpg`}>
            <Zap className="size-3.5" />
            Low CpG
          </Link>
        </Button>
      </div>
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
        className="inline-flex items-center gap-1 hover:text-foreground"
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
          <TableCell colSpan={COLUMN_COUNT} className="text-muted-foreground text-center">
            Loading isoforms...
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

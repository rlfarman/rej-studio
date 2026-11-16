import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatInheritanceLabel, type AssociationRow } from '../types'
import { diseaseAssociationsCopy } from '../copy'
import { rowBuckets, type SortDir, type SortKey } from '../api/associations'

type Props = {
  rows: AssociationRow[]
  sortKey: SortKey
  sortDir: SortDir
  /**
   * Current search params serialized as a plain object, so the sortable
   * header links can preserve query + inheritance filters when toggling sort.
   */
  searchParams: Record<string, string | string[] | undefined>
}

const cdsFormatter = new Intl.NumberFormat('en-US')
const { largestCdsUnit, largestCdsUnknown, phenotypeUnknown } =
  diseaseAssociationsCopy.table

export function AssociationsTable({
  rows,
  sortKey,
  sortDir,
  searchParams,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-card text-muted-foreground rounded-lg border p-6 text-center text-sm shadow-sm">
        {diseaseAssociationsCopy.table.empty}
      </div>
    )
  }

  const headerProps = { sortKey, sortDir, searchParams }

  // TableCell defaults to nowrap, which let a 120-character gene name push
  // the numeric columns off-screen. Text columns wrap (names clamp to two
  // lines); the CDS column stays on one line.
  return (
    <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
      <Table aria-label={diseaseAssociationsCopy.table.ariaLabel}>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead
              className="w-[96px] px-4"
              aria-sort={ariaSortFor(
                'symbol',
                headerProps.sortKey,
                headerProps.sortDir,
              )}
            >
              <SortHeader
                label={diseaseAssociationsCopy.table.columns.symbol}
                column="symbol"
                defaultDir="asc"
                {...headerProps}
              />
            </TableHead>
            <TableHead className="min-w-48 px-4">
              {diseaseAssociationsCopy.table.columns.name}
            </TableHead>
            <TableHead className="min-w-44 px-4">
              {diseaseAssociationsCopy.table.columns.phenotype}
            </TableHead>
            <TableHead className="w-40 px-4">
              {diseaseAssociationsCopy.table.columns.inheritance}
            </TableHead>
            <TableHead
              className="w-[132px] px-4 text-right whitespace-nowrap"
              aria-sort={ariaSortFor(
                'cds',
                headerProps.sortKey,
                headerProps.sortDir,
              )}
            >
              <SortHeader
                label={diseaseAssociationsCopy.table.columns.largestCds}
                column="cds"
                defaultDir="desc"
                align="right"
                {...headerProps}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-card">
          {rows.map((row) => {
            const buckets = Array.from(rowBuckets(row))
            const phenotype = firstPhenotypeLabel(row)
            return (
              <TableRow key={row.symbol} className="bg-card hover:bg-muted/25">
                <TableCell className="px-4 py-2.5">
                  <Link
                    href={`/genes/${encodeURIComponent(row.symbol)}?species=human`}
                    className="text-primary -my-1 inline-flex min-h-6 items-center py-1 font-mono font-semibold hover:underline"
                    aria-label={diseaseAssociationsCopy.table.viewGeneAria(
                      row.symbol,
                    )}
                  >
                    {row.symbol}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground px-4 py-2.5 text-sm whitespace-normal">
                  <span className="line-clamp-2" title={row.name}>
                    {row.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground px-4 py-2.5 text-sm whitespace-normal">
                  {phenotype}
                </TableCell>
                <TableCell className="px-4 py-2.5 whitespace-normal">
                  <div className="flex flex-wrap gap-1">
                    {buckets.map((b) => (
                      <Badge
                        key={b}
                        variant="secondary"
                        className="type-micro font-normal"
                      >
                        {formatInheritanceLabel(b)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground px-4 py-2.5 text-right font-mono text-xs">
                  {row.largestCds != null ? (
                    <>
                      {cdsFormatter.format(row.largestCds)}
                      {/* The cell is already muted; dimming the unit further
                          dropped it below 4.5:1. */}
                      <span className="ml-1">{largestCdsUnit}</span>
                    </>
                  ) : (
                    largestCdsUnknown
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

const SKELETON_ROWS = 8

/** Placeholder for the summary line and the first rows while params resolve. */
export function AssociationsTableSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="bg-muted h-3 w-24 animate-pulse rounded" />
      <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
        <div className="bg-muted/50 h-10 border-b" />
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div
            key={i}
            className="flex h-12 items-center gap-6 border-b px-4 last:border-0"
          >
            <div className="bg-muted h-4 w-14 animate-pulse rounded" />
            <div className="bg-muted h-4 flex-1 animate-pulse rounded" />
            <div className="bg-muted hidden h-4 w-40 animate-pulse rounded sm:block" />
            <div className="bg-muted h-4 w-16 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

const PHENOTYPE_MAX_CHARS = 48

function firstPhenotypeLabel(row: AssociationRow): string {
  const name = row.phenotypes[0]?.name.trim()
  if (!name) return phenotypeUnknown
  return name.length > PHENOTYPE_MAX_CHARS
    ? name.slice(0, PHENOTYPE_MAX_CHARS).trimEnd() + '…'
    : name
}

/** Value for the column header's aria-sort (it must sit on the header cell). */
function ariaSortFor(
  column: SortKey,
  sortKey: SortKey,
  sortDir: SortDir,
): 'ascending' | 'descending' | 'none' {
  if (sortKey !== column) return 'none'
  return sortDir === 'asc' ? 'ascending' : 'descending'
}

type SortHeaderProps = {
  label: string
  column: SortKey
  /** Direction to use when this column isn't currently the sort key. */
  defaultDir: SortDir
  align?: 'left' | 'right'
  sortKey: SortKey
  sortDir: SortDir
  searchParams: Record<string, string | string[] | undefined>
}

function SortHeader({
  label,
  column,
  defaultDir,
  align = 'left',
  sortKey,
  sortDir,
  searchParams,
}: SortHeaderProps) {
  const active = sortKey === column
  const nextDir: SortDir = active
    ? sortDir === 'asc'
      ? 'desc'
      : 'asc'
    : defaultDir

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'sort' || key === 'dir') continue
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v)
    } else {
      params.set(key, value)
    }
  }
  params.set('sort', column)
  params.set('dir', nextDir)
  const href = `?${params.toString()}`

  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <Link
      href={href}
      scroll={false}
      replace
      className={cn(
        'hover:text-foreground -my-2 inline-flex min-h-9 items-center gap-1 py-2 transition-colors',
        align === 'right' && 'flex-row-reverse',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {label}
      <Icon className="size-3" aria-hidden />
    </Link>
  )
}

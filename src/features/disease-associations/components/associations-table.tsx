import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'

type Props = {
  rows: AssociationRow[]
  sortKey: SortKey
  sortDir: SortDir
}

const cdsFormatter = new Intl.NumberFormat('en-US')
const { largestCdsUnit, largestCdsUnknown, phenotypeUnknown } =
  diseaseAssociationsCopy.table

export function AssociationsTable({ rows, sortKey, sortDir }: Props) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-center text-muted-foreground">
          {diseaseAssociationsCopy.table.empty}
        </CardContent>
      </Card>
    )
  }

  const headerProps = { sortKey, sortDir }

  // TableCell defaults to nowrap, which let a 120-character gene name push
  // the numeric columns off-screen. Text columns wrap (names clamp to two
  // lines); the CDS column stays on one line.
  return (
    <Card className="gap-0 py-0">
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
                    to="/genes/$symbol"
                    params={{ symbol: row.symbol }}
                    search={{ species: 'human' }}
                    className="-my-1 inline-flex min-h-6 items-center py-1 font-mono font-semibold text-primary hover:underline"
                    aria-label={diseaseAssociationsCopy.table.viewGeneAria(
                      row.symbol,
                    )}
                  >
                    {row.symbol}
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-sm whitespace-normal text-muted-foreground">
                  <span className="line-clamp-2" title={row.name}>
                    {row.name}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-sm whitespace-normal text-muted-foreground">
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
                <TableCell className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
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
    </Card>
  )
}

const SKELETON_ROWS = 8

/** Placeholder for the summary line and the first rows while params resolve. */
export function AssociationsTableSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <Skeleton className="h-3 w-24" />
      <Card className="gap-0 py-0">
        <div className="h-10 border-b bg-muted/50" />
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div
            key={i}
            className="flex h-12 items-center gap-6 border-b px-4 last:border-0"
          >
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-40 sm:block" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </Card>
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
}

function SortHeader({
  label,
  column,
  defaultDir,
  align = 'left',
  sortKey,
  sortDir,
}: SortHeaderProps) {
  const active = sortKey === column
  const nextDir: SortDir = active
    ? sortDir === 'asc'
      ? 'desc'
      : 'asc'
    : defaultDir

  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <Link
      // Keeps the filters and the page; replaces the history entry, since a
      // re-sort isn't a step to go back through.
      from="/disease-associations"
      to="."
      search={(prev) => ({ ...prev, sort: column, dir: nextDir })}
      resetScroll={false}
      replace
      className={cn(
        '-my-2 inline-flex min-h-9 items-center gap-1 py-2 transition-colors hover:text-foreground',
        align === 'right' && 'flex-row-reverse',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {label}
      <Icon className="size-3" aria-hidden />
    </Link>
  )
}

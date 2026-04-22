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
import type { AssociationRow } from '../types'
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
const { largestCdsUnit, largestCdsUnknown } = diseaseAssociationsCopy.table

export function AssociationsTable({
  rows,
  sortKey,
  sortDir,
  searchParams,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
        {diseaseAssociationsCopy.table.empty}
      </div>
    )
  }

  const headerProps = { sortKey, sortDir, searchParams }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table aria-label={diseaseAssociationsCopy.table.ariaLabel}>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-[120px]">
              <SortHeader
                label={diseaseAssociationsCopy.table.columns.symbol}
                column="symbol"
                defaultDir="asc"
                {...headerProps}
              />
            </TableHead>
            <TableHead>{diseaseAssociationsCopy.table.columns.name}</TableHead>
            <TableHead className="w-[280px]">
              {diseaseAssociationsCopy.table.columns.inheritance}
            </TableHead>
            <TableHead className="w-[110px] text-right">
              <SortHeader
                label={diseaseAssociationsCopy.table.columns.phenotypeCount}
                column="phenotypes"
                defaultDir="desc"
                align="right"
                {...headerProps}
              />
            </TableHead>
            <TableHead className="w-[130px] text-right">
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
        <TableBody>
          {rows.map((row) => {
            const buckets = Array.from(rowBuckets(row))
            return (
              <TableRow key={row.symbol} className="hover:bg-muted/30">
                <TableCell className="py-2.5">
                  <Link
                    href={`/genes/${encodeURIComponent(row.symbol)}?species=human`}
                    className="text-primary font-mono font-semibold hover:underline"
                    aria-label={diseaseAssociationsCopy.table.viewGeneAria(
                      row.symbol,
                    )}
                  >
                    {row.symbol}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground py-2.5 text-sm">
                  {row.name}
                </TableCell>
                <TableCell className="py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {buckets.map((b) => (
                      <Badge
                        key={b}
                        variant="secondary"
                        className="text-[10px] font-normal"
                      >
                        {b}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground py-2.5 text-right font-mono text-xs">
                  {row.phenotypes.length}
                </TableCell>
                <TableCell className="text-muted-foreground py-2.5 text-right font-mono text-xs">
                  {row.largestCds != null ? (
                    <>
                      {cdsFormatter.format(row.largestCds)}
                      <span className="text-muted-foreground/70 ml-1">
                        {largestCdsUnit}
                      </span>
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

  const ariaSort = active
    ? sortDir === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none'

  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <Link
      href={href}
      scroll={false}
      replace
      aria-sort={ariaSort}
      className={cn(
        'hover:text-foreground inline-flex items-center gap-1 transition-colors',
        align === 'right' && 'flex-row-reverse',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {label}
      <Icon className="size-3" aria-hidden />
    </Link>
  )
}

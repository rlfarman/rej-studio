import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AssociationRow } from '../types'
import { diseaseAssociationsCopy } from '../copy'
import { rowBuckets } from '../api/associations'

type Props = {
  rows: AssociationRow[]
}

export function AssociationsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
        {diseaseAssociationsCopy.table.empty}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table aria-label={diseaseAssociationsCopy.table.ariaLabel}>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-[120px]">
              {diseaseAssociationsCopy.table.columns.symbol}
            </TableHead>
            <TableHead>{diseaseAssociationsCopy.table.columns.name}</TableHead>
            <TableHead className="w-[280px]">
              {diseaseAssociationsCopy.table.columns.inheritance}
            </TableHead>
            <TableHead className="w-[110px] text-right">
              {diseaseAssociationsCopy.table.columns.phenotypeCount}
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
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

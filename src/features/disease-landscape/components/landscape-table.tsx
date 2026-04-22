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
import type { LandscapeRow } from '../types'
import { diseaseLandscapeCopy } from '../copy'
import { rowBuckets } from '../api/landscape'

type Props = {
  rows: LandscapeRow[]
  maxCdsByGeneId: Map<string, number>
}

const cdsFormatter = new Intl.NumberFormat('en-US')

export function LandscapeTable({ rows, maxCdsByGeneId }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
        {diseaseLandscapeCopy.table.empty}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table aria-label={diseaseLandscapeCopy.table.ariaLabel}>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-[120px]">
              {diseaseLandscapeCopy.table.columns.symbol}
            </TableHead>
            <TableHead>{diseaseLandscapeCopy.table.columns.name}</TableHead>
            <TableHead className="w-[280px]">
              {diseaseLandscapeCopy.table.columns.inheritance}
            </TableHead>
            <TableHead className="w-[110px] text-right">
              {diseaseLandscapeCopy.table.columns.phenotypeCount}
            </TableHead>
            <TableHead className="w-[130px] text-right">
              {diseaseLandscapeCopy.table.columns.largestCds}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const buckets = Array.from(rowBuckets(row))
            const maxCds = row.ensemblGeneId
              ? maxCdsByGeneId.get(row.ensemblGeneId)
              : undefined
            return (
              <TableRow key={row.symbol} className="hover:bg-muted/30">
                <TableCell className="py-2.5">
                  <Link
                    href={`/genes/${encodeURIComponent(row.symbol)}?species=human`}
                    className="text-primary font-mono font-semibold hover:underline"
                    aria-label={diseaseLandscapeCopy.table.viewGeneAria(
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
                  {maxCds != null ? (
                    <>
                      {cdsFormatter.format(maxCds)}
                      <span className="text-muted-foreground/70 ml-1">
                        {diseaseLandscapeCopy.table.largestCdsUnit}
                      </span>
                    </>
                  ) : (
                    diseaseLandscapeCopy.table.largestCdsUnknown
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

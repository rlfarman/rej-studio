'use client'

import { Badge } from '@/components/ui/badge'
import { PackageCheck, PackageX, Package } from 'lucide-react'
import { AAV_OVERHEAD_BP, AAV_PACKAGING_LIMIT } from '@/lib/bio/aav'
import { designToolCopy } from '../copy'

const copy = designToolCopy.aav

interface AavResultsProps {
  seq5Length: number
  seq3Length: number
}

function sizeStatus(totalBp: number) {
  if (totalBp <= AAV_PACKAGING_LIMIT) return 'fits' as const
  if (totalBp <= AAV_PACKAGING_LIMIT + 300) return 'tight' as const
  return 'too-large' as const
}

function StatusIcon({ status }: { status: 'fits' | 'tight' | 'too-large' }) {
  if (status === 'fits') return <PackageCheck className="size-3.5" />
  if (status === 'tight') return <Package className="size-3.5" />
  return <PackageX className="size-3.5" />
}

/**
 * Results version: shown after optimization with actual 5'/3' sizes.
 */
export function AavResults({ seq5Length, seq3Length }: AavResultsProps) {
  const fiveTotal = seq5Length + AAV_OVERHEAD_BP
  const threeTotal = seq3Length + AAV_OVERHEAD_BP
  const fiveStatus = sizeStatus(fiveTotal)
  const threeStatus = sizeStatus(threeTotal)

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium">{copy.results.heading}</span>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/50 flex flex-col rounded-2xl border p-3">
          <span className="text-muted-foreground text-xs font-medium">
            {copy.results.fiveVector}
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-sm font-medium tabular-nums">
              ~{fiveTotal.toLocaleString()} bp
            </span>
            <Badge
              variant={
                fiveStatus === 'fits'
                  ? 'secondary'
                  : fiveStatus === 'tight'
                    ? 'outline'
                    : 'destructive'
              }
              className="type-micro"
            >
              <StatusIcon status={fiveStatus} />
              {fiveStatus === 'fits'
                ? copy.results.fits
                : fiveStatus === 'tight'
                  ? copy.results.tight
                  : copy.results.overLimit}
            </Badge>
          </div>
          <span className="text-muted-foreground type-micro mt-1">
            {seq5Length.toLocaleString()} bp + ~
            {AAV_OVERHEAD_BP.toLocaleString()} overhead
          </span>
        </div>
        <div className="bg-muted/50 flex flex-col rounded-2xl border p-3">
          <span className="text-muted-foreground text-xs font-medium">
            {copy.results.threeVector}
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-sm font-medium tabular-nums">
              ~{threeTotal.toLocaleString()} bp
            </span>
            <Badge
              variant={
                threeStatus === 'fits'
                  ? 'secondary'
                  : threeStatus === 'tight'
                    ? 'outline'
                    : 'destructive'
              }
              className="type-micro"
            >
              <StatusIcon status={threeStatus} />
              {threeStatus === 'fits'
                ? copy.results.fits
                : threeStatus === 'tight'
                  ? copy.results.tight
                  : copy.results.overLimit}
            </Badge>
          </div>
          <span className="text-muted-foreground type-micro mt-1">
            {seq3Length.toLocaleString()} bp + ~
            {AAV_OVERHEAD_BP.toLocaleString()} overhead
          </span>
        </div>
      </div>
      <p className="text-muted-foreground type-nano">
        Estimates assume ~{AAV_OVERHEAD_BP.toLocaleString()} bp overhead (ITRs +
        promoter + polyA + regulatory elements). AAV packaging limit is ~
        {AAV_PACKAGING_LIMIT.toLocaleString()} bp.
      </p>
    </div>
  )
}

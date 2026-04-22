'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PackageCheck, PackageX, Package } from 'lucide-react'
import { AAV_OVERHEAD_BP, AAV_PACKAGING_LIMIT } from '@/lib/bio/aav'
import { designToolCopy } from '../copy'

const copy = designToolCopy.aav

interface AavPreflightProps {
  sequenceLength: number
}

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
 * Preflight version: shown in the diagnostics area based on input sequence length.
 */
export function AavPreflight({ sequenceLength }: AavPreflightProps) {
  if (sequenceLength === 0) return null

  const singleTotal = sequenceLength + AAV_OVERHEAD_BP
  const singleStatus = sizeStatus(singleTotal)
  const halfSeq = Math.ceil(sequenceLength / 2)
  const dualPerVector = halfSeq + AAV_OVERHEAD_BP
  const dualStatus = sizeStatus(dualPerVector)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={
            singleStatus === 'fits'
              ? 'secondary'
              : dualStatus === 'fits'
                ? 'outline'
                : 'destructive'
          }
          className="gap-1 select-none"
        >
          <StatusIcon status={singleStatus === 'fits' ? 'fits' : dualStatus} />
          {singleStatus === 'fits'
            ? copy.preflight.single
            : dualStatus === 'fits'
              ? copy.preflight.dual
              : dualStatus === 'tight'
                ? copy.preflight.dualTight
                : copy.preflight.exceeds}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">
        <p>
          Estimated total: ~{singleTotal.toLocaleString()} bp (sequence + ~
          {AAV_OVERHEAD_BP.toLocaleString()} bp overhead).
        </p>
        <p>AAV limit: ~{AAV_PACKAGING_LIMIT.toLocaleString()} bp.</p>
        {singleStatus !== 'fits' && (
          <p>Dual vector: ~{dualPerVector.toLocaleString()} bp per half.</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
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
        <div className="bg-muted/50 flex flex-col rounded-lg border p-3">
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
              className="text-[10px]"
            >
              <StatusIcon status={fiveStatus} />
              {fiveStatus === 'fits'
                ? copy.results.fits
                : fiveStatus === 'tight'
                  ? copy.results.tight
                  : copy.results.overLimit}
            </Badge>
          </div>
          <span className="text-muted-foreground mt-1 text-[10px]">
            {seq5Length.toLocaleString()} bp + ~
            {AAV_OVERHEAD_BP.toLocaleString()} overhead
          </span>
        </div>
        <div className="bg-muted/50 flex flex-col rounded-lg border p-3">
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
              className="text-[10px]"
            >
              <StatusIcon status={threeStatus} />
              {threeStatus === 'fits'
                ? copy.results.fits
                : threeStatus === 'tight'
                  ? copy.results.tight
                  : copy.results.overLimit}
            </Badge>
          </div>
          <span className="text-muted-foreground mt-1 text-[10px]">
            {seq3Length.toLocaleString()} bp + ~
            {AAV_OVERHEAD_BP.toLocaleString()} overhead
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-[11px]">
        Estimates assume ~{AAV_OVERHEAD_BP.toLocaleString()} bp overhead (ITRs +
        promoter + polyA + regulatory elements). AAV packaging limit is ~
        {AAV_PACKAGING_LIMIT.toLocaleString()} bp.
      </p>
    </div>
  )
}

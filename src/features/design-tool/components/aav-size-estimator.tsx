'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PackageCheck, PackageX, Package } from 'lucide-react'
import {
  AAV_SINGLE_CDS_MAX,
  AAV_DUAL_CDS_MAX,
  cdsToVectorCount,
} from '@/lib/bio/aav'
import { designToolCopy } from '../copy'

const copy = designToolCopy.aav

interface AavPreflightProps {
  sequenceLength: number
}

interface AavResultsProps {
  seq5Length: number
  seq3Length: number
}

type FragmentStatus = 'fits' | 'over-limit'

function fragmentStatus(cdsLength: number): FragmentStatus {
  return cdsLength < AAV_SINGLE_CDS_MAX ? 'fits' : 'over-limit'
}

function StatusIcon({
  status,
}: {
  status: FragmentStatus | 'dual' | 'triple'
}) {
  if (status === 'fits') return <PackageCheck className="size-3.5" />
  if (status === 'over-limit') return <PackageX className="size-3.5" />
  return <Package className="size-3.5" />
}

/**
 * Preflight version: shown in the diagnostics area based on input sequence length.
 */
export function AavPreflight({ sequenceLength }: AavPreflightProps) {
  if (sequenceLength === 0) return null

  const vectors = cdsToVectorCount(sequenceLength)
  const label =
    vectors === 1
      ? copy.preflight.single
      : vectors === 2
        ? copy.preflight.dual
        : copy.preflight.triple
  const iconStatus: FragmentStatus | 'dual' | 'triple' =
    vectors === 1 ? 'fits' : vectors === 2 ? 'dual' : 'triple'
  const variant =
    vectors === 1 ? 'secondary' : vectors === 2 ? 'outline' : 'destructive'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className="gap-1 select-none">
          <StatusIcon status={iconStatus} />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">
        <p>CDS length: {sequenceLength.toLocaleString()} bp.</p>
        <p>
          Single AAV: CDS &lt; {AAV_SINGLE_CDS_MAX.toLocaleString()} bp. Dual:
          &lt; {AAV_DUAL_CDS_MAX.toLocaleString()} bp. Triple beyond.
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Results version: shown after optimization with actual 5'/3' sizes.
 */
export function AavResults({ seq5Length, seq3Length }: AavResultsProps) {
  const fiveStatus = fragmentStatus(seq5Length)
  const threeStatus = fragmentStatus(seq3Length)

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium">{copy.results.heading}</span>
      <div className="grid grid-cols-2 gap-2">
        <FragmentCard
          label={copy.results.fiveVector}
          length={seq5Length}
          status={fiveStatus}
        />
        <FragmentCard
          label={copy.results.threeVector}
          length={seq3Length}
          status={threeStatus}
        />
      </div>
      <p className="text-muted-foreground text-[11px]">
        Each fragment must be under {AAV_SINGLE_CDS_MAX.toLocaleString()} bp to
        fit in a single AAV.
      </p>
    </div>
  )
}

function FragmentCard({
  label,
  length,
  status,
}: {
  label: string
  length: number
  status: FragmentStatus
}) {
  return (
    <div className="bg-muted/50 flex flex-col rounded-lg border p-3">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-sm font-medium tabular-nums">
          {length.toLocaleString()} bp
        </span>
        <Badge
          variant={status === 'fits' ? 'secondary' : 'destructive'}
          className="text-[10px]"
        >
          <StatusIcon status={status} />
          {status === 'fits' ? copy.results.fits : copy.results.overLimit}
        </Badge>
      </div>
    </div>
  )
}

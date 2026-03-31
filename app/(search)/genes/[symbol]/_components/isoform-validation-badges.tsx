'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  computeGcPercent,
  hasStartCodon,
  getStopCodonStatus,
} from '@/lib/sequence-utils'

interface IsoformValidationBadgesProps {
  codingSequence: string
  codingSequenceLength: number
}

export function IsoformValidationBadges({
  codingSequence,
  codingSequenceLength,
}: IsoformValidationBadgesProps) {
  const checks = useMemo(() => {
    const multipleOf3 = codingSequence.length % 3 === 0
    const startCodon = hasStartCodon(codingSequence)
    const stopCodon = getStopCodonStatus(codingSequence)
    const gc = computeGcPercent(codingSequence)
    const fitsAav = codingSequenceLength <= 4700

    return { multipleOf3, startCodon, stopCodon, gc, fitsAav }
  }, [codingSequence, codingSequenceLength])

  function gcVariant(): 'default' | 'secondary' | 'destructive' {
    if (checks.gc >= 40 && checks.gc <= 60) return 'default'
    if (checks.gc >= 30 && checks.gc <= 70) return 'secondary'
    return 'destructive'
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <ValidationBadge
        pass={checks.multipleOf3}
        label={checks.multipleOf3 ? 'Codon-complete' : 'Not multiple of 3'}
        tooltip="CDS length should be a multiple of 3"
      />
      <ValidationBadge
        pass={checks.startCodon}
        label={checks.startCodon ? 'ATG start' : 'No ATG'}
        tooltip="Valid start codon (ATG)"
      />
      <ValidationBadge
        pass={checks.stopCodon === 'present'}
        label={checks.stopCodon === 'present' ? 'Stop codon' : 'No stop'}
        tooltip="Valid stop codon (TAA, TAG, or TGA)"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={gcVariant()} className="text-xs">
            GC {checks.gc.toFixed(1)}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          GC content: {checks.gc.toFixed(1)}% (ideal: 40–60%)
        </TooltipContent>
      </Tooltip>
      <ValidationBadge
        pass={checks.fitsAav}
        label={checks.fitsAav ? 'Fits AAV' : 'Oversized'}
        tooltip={
          checks.fitsAav
            ? 'CDS fits within single AAV packaging limit (~4700 bp)'
            : 'CDS exceeds AAV packaging limit (~4700 bp)'
        }
      />
    </div>
  )
}

function ValidationBadge({
  pass,
  label,
  tooltip,
}: {
  pass: boolean
  label: string
  tooltip: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={pass ? 'default' : 'destructive'}
          className="text-xs"
        >
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

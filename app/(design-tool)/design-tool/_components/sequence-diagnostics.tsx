'use client'

import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CircleCheck, CircleAlert, CircleMinus } from 'lucide-react'
import { FormValues } from './form-schema'
import {
  computeGcPercent,
  hasStartCodon,
  getStopCodonStatus,
  findInvalidChars,
  assessFragmentBalance,
} from '@/design-tool/lib/sequence-utils'
import { AavPreflight } from './aav-size-estimator'

function DiagBadge({
  status,
  label,
  tooltip,
}: {
  status: 'good' | 'warn' | 'error' | 'neutral'
  label: string
  tooltip: string
}) {
  const variant =
    status === 'good'
      ? 'secondary'
      : status === 'error'
        ? 'destructive'
        : 'outline'

  const Icon =
    status === 'good'
      ? CircleCheck
      : status === 'error'
        ? CircleAlert
        : status === 'warn'
          ? CircleAlert
          : CircleMinus

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className="gap-1 select-none">
          <Icon className="size-3" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-56">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function SequenceDiagnostics() {
  const { watch } = useFormContext<FormValues>()
  const codingSequence = watch('codingSequence')
  const spliceJunctionPosition = watch('spliceJunctionPosition')

  const seq = codingSequence?.toUpperCase() ?? ''

  const stats = useMemo(() => {
    if (seq.length === 0) return null

    const bpLength = seq.length
    const aaLength = Math.floor(bpLength / 3)
    const gcPercent = computeGcPercent(seq)
    const startCodon = hasStartCodon(seq)
    const stopCodon = getStopCodonStatus(seq)
    const invalidChars = findInvalidChars(seq)
    const balance = assessFragmentBalance(spliceJunctionPosition, bpLength)
    const multipleOf3 = bpLength % 3 === 0

    return {
      bpLength,
      aaLength,
      gcPercent,
      startCodon,
      stopCodon,
      invalidChars,
      balance,
      multipleOf3,
    }
  }, [seq, spliceJunctionPosition])

  if (!stats) return null

  const gcStatus: 'good' | 'warn' | 'error' =
    stats.gcPercent >= 35 && stats.gcPercent <= 60
      ? 'good'
      : stats.gcPercent >= 25 && stats.gcPercent <= 70
        ? 'warn'
        : 'error'

  return (
    <div className="bg-muted/50 flex flex-wrap gap-2 rounded-lg border p-3">
      <DiagBadge
        status="neutral"
        label={`${stats.bpLength.toLocaleString()} bp / ${stats.aaLength.toLocaleString()} aa`}
        tooltip="Sequence length in base pairs and amino acids"
      />

      <DiagBadge
        status={gcStatus}
        label={`GC ${stats.gcPercent.toFixed(1)}%`}
        tooltip={
          gcStatus === 'good'
            ? 'GC content is in the optimal 35-60% range.'
            : gcStatus === 'warn'
              ? 'GC content is outside the optimal 35-60% range.'
              : 'GC content is far from the optimal 35-60% range.'
        }
      />

      <DiagBadge
        status={stats.startCodon ? 'good' : 'error'}
        label={stats.startCodon ? 'Start: ATG' : 'No start codon'}
        tooltip={
          stats.startCodon
            ? 'Sequence begins with ATG start codon'
            : 'Sequence does not begin with ATG. This may not be a valid CDS.'
        }
      />

      <DiagBadge
        status={
          stats.stopCodon === 'present'
            ? 'good'
            : stats.stopCodon === 'absent'
              ? 'warn'
              : 'neutral'
        }
        label={
          stats.stopCodon === 'present'
            ? `Stop: ${seq.slice(-3)}`
            : 'No stop codon'
        }
        tooltip={
          stats.stopCodon === 'present'
            ? `Sequence ends with ${seq.slice(-3)} stop codon`
            : 'No stop codon detected at the end of the sequence'
        }
      />

      {!stats.multipleOf3 && (
        <DiagBadge
          status="error"
          label="Not multiple of 3"
          tooltip="Sequence length must be a multiple of 3 for valid codon reading frame"
        />
      )}

      {stats.invalidChars.length > 0 && (
        <DiagBadge
          status="error"
          label={`${stats.invalidChars.length} invalid char${stats.invalidChars.length > 1 ? 's' : ''}`}
          tooltip={`Found invalid characters: ${stats.invalidChars.join(', ')}`}
        />
      )}

      <DiagBadge
        status={
          stats.balance === 'balanced'
            ? 'good'
            : stats.balance === 'moderate'
              ? 'warn'
              : 'error'
        }
        label={`Split: ${Math.round((spliceJunctionPosition / stats.bpLength) * 100)}% / ${Math.round(100 - (spliceJunctionPosition / stats.bpLength) * 100)}%`}
        tooltip={
          stats.balance === 'balanced'
            ? 'Fragment sizes are well balanced.'
            : stats.balance === 'moderate'
              ? 'Fragments are moderately imbalanced. Consider centering the split.'
              : 'Fragments are highly imbalanced. This may cause issues with AAV packaging.'
        }
      />

      <AavPreflight sequenceLength={stats.bpLength} />
    </div>
  )
}

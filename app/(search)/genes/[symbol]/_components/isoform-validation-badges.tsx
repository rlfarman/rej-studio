'use client'

import { useMemo } from 'react'
import { DiagBadge, type DiagStatus } from '@/components/diag-badge'
import {
  computeGcPercent,
  hasStartCodon,
  getStopCodonStatus,
  findInvalidChars,
} from '@/lib/sequence-utils'

interface IsoformValidationBadgesProps {
  codingSequence: string
  codingSequenceLength: number
}

export function IsoformValidationBadges({
  codingSequence,
  codingSequenceLength,
}: IsoformValidationBadgesProps) {
  const seq = codingSequence.toUpperCase()

  const stats = useMemo(() => {
    const bpLength = seq.length
    const aaLength = Math.floor(bpLength / 3)
    const gcPercent = computeGcPercent(seq)
    const startCodon = hasStartCodon(seq)
    const stopCodon = getStopCodonStatus(seq)
    const invalidChars = findInvalidChars(seq)
    const multipleOf3 = bpLength % 3 === 0
    const fitsAav = codingSequenceLength <= 4700

    return {
      bpLength,
      aaLength,
      gcPercent,
      startCodon,
      stopCodon,
      invalidChars,
      multipleOf3,
      fitsAav,
    }
  }, [seq, codingSequenceLength])

  const gcStatus: DiagStatus =
    stats.gcPercent >= 35 && stats.gcPercent <= 60
      ? 'good'
      : stats.gcPercent >= 25 && stats.gcPercent <= 70
        ? 'warn'
        : 'error'

  return (
    <div className="flex flex-wrap gap-2">
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
            ? 'GC content is in the optimal 35–60% range.'
            : gcStatus === 'warn'
              ? 'GC content is outside the optimal 35–60% range.'
              : 'GC content is far from the optimal 35–60% range.'
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
        status={stats.fitsAav ? 'good' : 'warn'}
        label={stats.fitsAav ? 'Fits AAV' : 'Exceeds AAV'}
        tooltip={
          stats.fitsAav
            ? 'CDS fits within single AAV packaging limit (~4,700 bp)'
            : 'CDS exceeds single AAV packaging limit (~4,700 bp) — will require dual-AAV splitting'
        }
      />
    </div>
  )
}

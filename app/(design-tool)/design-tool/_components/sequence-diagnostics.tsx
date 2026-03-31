'use client'

import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { FormValues } from './form-schema'
import {
  DiagBadge,
  lengthCheck,
  gcCheck,
  startCodonCheck,
  stopCodonCheck,
  multipleOf3Check,
  invalidCharsCheck,
} from '@/components/diag-badge'
import { assessFragmentBalance } from '@/lib/sequence-utils'
import { AavPreflight } from './aav-size-estimator'

export function SequenceDiagnostics() {
  const { watch } = useFormContext<FormValues>()
  const codingSequence = watch('codingSequence')
  const spliceJunctionPosition = watch('spliceJunctionPosition')

  const seq = codingSequence?.toUpperCase() ?? ''

  const diagnostics = useMemo(() => {
    if (seq.length === 0) return null

    const bpLength = seq.length
    const balance = assessFragmentBalance(spliceJunctionPosition, bpLength)

    const checks = [
      lengthCheck(seq),
      gcCheck(seq),
      startCodonCheck(seq),
      stopCodonCheck(seq),
    ]

    const m3 = multipleOf3Check(seq)
    if (m3) checks.push(m3)
    const inv = invalidCharsCheck(seq)
    if (inv) checks.push(inv)

    return { checks, balance, bpLength }
  }, [seq, spliceJunctionPosition])

  if (!diagnostics) return null

  return (
    <div className="bg-muted/50 flex flex-wrap gap-2 rounded-lg border p-3">
      {diagnostics.checks.map((check) => (
        <DiagBadge key={check.label} {...check} />
      ))}

      <DiagBadge
        status={
          diagnostics.balance === 'balanced'
            ? 'good'
            : diagnostics.balance === 'moderate'
              ? 'warn'
              : 'error'
        }
        label={`Split: ${Math.round((spliceJunctionPosition / diagnostics.bpLength) * 100)}% / ${Math.round(100 - (spliceJunctionPosition / diagnostics.bpLength) * 100)}%`}
        tooltip={
          diagnostics.balance === 'balanced'
            ? 'Fragment sizes are well balanced.'
            : diagnostics.balance === 'moderate'
              ? 'Fragments are moderately imbalanced. Consider centering the split.'
              : 'Fragments are highly imbalanced. This may cause issues with AAV packaging.'
        }
      />

      <AavPreflight sequenceLength={diagnostics.bpLength} />
    </div>
  )
}

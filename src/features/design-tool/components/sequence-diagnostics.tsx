import { useFormContext, useWatch } from 'react-hook-form'
import { FormValues } from '../types/form-schema'
import {
  DiagBadge,
  bpLengthCheck,
  aaLengthCheck,
  startCodonCheck,
  stopCodonCheck,
  multipleOf3Check,
  invalidCharsCheck,
  prematureStopCheck,
} from '@/components/bio/diag-badge'

export function SequenceDiagnostics() {
  const { control } = useFormContext<FormValues>()
  const codingSequence = useWatch({ control, name: 'codingSequence' })

  const seq = codingSequence?.toUpperCase() ?? ''

  const diagnostics = runDiagnostics(seq)

  if (!diagnostics) return null

  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border bg-muted/50 p-3">
      {diagnostics.checks.map((check) => (
        <DiagBadge key={check.label} {...check} />
      ))}
    </div>
  )
}

/** The coding-sequence checks to show, or null for an empty sequence. */
function runDiagnostics(seq: string) {
  if (seq.length === 0) return null

  const checks = [
    bpLengthCheck(seq),
    aaLengthCheck(seq),
    startCodonCheck(seq),
    stopCodonCheck(seq),
  ]

  const m3 = multipleOf3Check(seq)
  if (m3) checks.push(m3)
  const inv = invalidCharsCheck(seq)
  if (inv) checks.push(inv)
  const ps = prematureStopCheck(seq)
  if (ps) checks.push(ps)

  return { checks }
}

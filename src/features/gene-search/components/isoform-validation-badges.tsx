'use client'

import { useMemo } from 'react'
import {
  DiagBadge,
  lengthCheck,
  gcCheck,
  startCodonCheck,
  stopCodonCheck,
  multipleOf3Check,
  invalidCharsCheck,
  aavFitCheck,
  homopolymerCheck,
  tandemRepeatCheck,
  prematureStopCheck,
} from '@/components/bio/diag-badge'

interface IsoformValidationBadgesProps {
  codingSequence: string
  codingSequenceLength: number
}

export function IsoformValidationBadges({
  codingSequence,
  codingSequenceLength,
}: IsoformValidationBadgesProps) {
  const seq = codingSequence.toUpperCase()

  const checks = useMemo(() => {
    const required = [
      lengthCheck(seq),
      gcCheck(seq),
      startCodonCheck(seq),
      stopCodonCheck(seq),
    ]

    const m3 = multipleOf3Check(seq)
    if (m3) required.push(m3)
    const inv = invalidCharsCheck(seq)
    if (inv) required.push(inv)

    const premature = prematureStopCheck(seq)
    if (premature) required.push(premature)
    const homopolymer = homopolymerCheck(seq)
    if (homopolymer) required.push(homopolymer)
    const tandem = tandemRepeatCheck(seq)
    if (tandem) required.push(tandem)

    required.push(aavFitCheck(codingSequenceLength))
    return required
  }, [seq, codingSequenceLength])

  return (
    <div className="flex flex-wrap gap-2">
      {checks.map((check) => (
        <DiagBadge key={check.label} {...check} />
      ))}
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import {
  DiagBadge,
  startCodonCheck,
  stopCodonCheck,
  multipleOf3Check,
  invalidCharsCheck,
  homopolymerCheck,
  tandemRepeatCheck,
  prematureStopCheck,
} from '@/components/bio/diag-badge'

interface IsoformValidationBadgesProps {
  codingSequence: string
}

/**
 * Pass/fail validity checks for a coding sequence. Quantitative design
 * context (length, GC%, CpG, WGGW, AAV strategy) lives in the metrics
 * strip; this component only surfaces things that are either OK or broken.
 */
export function IsoformValidationBadges({
  codingSequence,
}: IsoformValidationBadgesProps) {
  const seq = codingSequence.toUpperCase()

  const checks = useMemo(() => {
    const required = [startCodonCheck(seq), stopCodonCheck(seq)]

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

    return required
  }, [seq])

  return (
    <div className="flex flex-wrap gap-2">
      {checks.map((check) => (
        <DiagBadge key={check.label} {...check} />
      ))}
    </div>
  )
}

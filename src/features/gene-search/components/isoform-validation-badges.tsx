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

  const checks = [
    startCodonCheck(seq),
    stopCodonCheck(seq),
    multipleOf3Check(seq),
    invalidCharsCheck(seq),
    prematureStopCheck(seq),
    homopolymerCheck(seq),
    tandemRepeatCheck(seq),
  ].filter((check) => check !== null)

  return (
    <div className="flex flex-wrap gap-2">
      {checks.map((check) => (
        <DiagBadge key={check.label} {...check} />
      ))}
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  rankInducibleWggwByBalance,
  assessFragmentBalance,
} from '@/lib/bio/sequence-utils'
import { AAV_OVERHEAD_BP, AAV_PACKAGING_LIMIT } from '@/lib/bio/aav'
import { SplitBar } from '@/components/bio/split-bar'

interface IsoformSplitPreviewProps {
  codingSequence: string
  codingSequenceLength: number
}

const BALANCE_CLASS = {
  balanced: 'text-success-soft',
  moderate: 'text-warning-soft',
  imbalanced: 'text-danger-soft',
} as const

const BALANCE_LABEL = {
  balanced: 'balanced',
  moderate: 'moderate',
  imbalanced: 'imbalanced',
} as const

export function IsoformSplitPreview({
  codingSequence,
  codingSequenceLength,
}: IsoformSplitPreviewProps) {
  const preview = useMemo(() => {
    const ranked = rankInducibleWggwByBalance(codingSequence)
    if (ranked.length === 0) return null
    const best = ranked[0]
    const balance = assessFragmentBalance(best.position, codingSequenceLength)
    const fiveAavTotal = best.fivePrimeLength + AAV_OVERHEAD_BP
    const threeAavTotal = best.threePrimeLength + AAV_OVERHEAD_BP
    const fiveFits = fiveAavTotal <= AAV_PACKAGING_LIMIT
    const threeFits = threeAavTotal <= AAV_PACKAGING_LIMIT
    // Surface 2 alternatives only when the best candidate is suboptimal —
    // either not balanced, or one of its fragments won't fit in an AAV.
    // When #1 is balanced and both-fits, the alternatives are just noise.
    const showAlternatives = balance !== 'balanced' || !fiveFits || !threeFits
    const alternatives = showAlternatives
      ? ranked.slice(1, 3).map((c) => ({
          ...c,
          bothFit:
            c.fivePrimeLength + AAV_OVERHEAD_BP <= AAV_PACKAGING_LIMIT &&
            c.threePrimeLength + AAV_OVERHEAD_BP <= AAV_PACKAGING_LIMIT,
        }))
      : []
    return {
      best,
      balance,
      fiveAavTotal,
      threeAavTotal,
      fiveFits,
      threeFits,
      alternatives,
    }
  }, [codingSequence, codingSequenceLength])

  if (preview === null) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Scissors className="size-3.5" />
        No WGGW-capable junctions found — this sequence cannot be split by REJ.
      </div>
    )
  }

  const {
    best,
    balance,
    fiveAavTotal,
    threeAavTotal,
    fiveFits,
    threeFits,
    alternatives,
  } = preview

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs">
        <Scissors className="size-3.5" />
        <span className="text-muted-foreground">Best REJ split:</span>
        <span className="font-mono tabular-nums">{best.motif}</span>
        <span className="text-muted-foreground">at bp</span>
        <span className="tabular-nums">{best.position.toLocaleString()}</span>
        {!best.alreadyPresent && (
          <span className="text-muted-foreground">
            (inducible; {best.baseChanges} bp change
            {best.baseChanges === 1 ? '' : 's'})
          </span>
        )}
        <span className={cn('font-medium', BALANCE_CLASS[balance])}>
          ({BALANCE_LABEL[balance]})
        </span>
      </div>

      <SplitBar
        fivePrimeLength={best.fivePrimeLength}
        threePrimeLength={best.threePrimeLength}
      />

      <div className="text-muted-foreground type-micro flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
        <span>
          5′ AAV: {fiveAavTotal.toLocaleString()} bp{' '}
          <span className={fiveFits ? 'text-success-soft' : 'text-danger-soft'}>
            ({fiveFits ? 'fits' : 'over limit'})
          </span>
        </span>
        <span>
          3′ AAV: {threeAavTotal.toLocaleString()} bp{' '}
          <span
            className={threeFits ? 'text-success-soft' : 'text-danger-soft'}
          >
            ({threeFits ? 'fits' : 'over limit'})
          </span>
        </span>
        <span className="opacity-70">
          (includes {AAV_OVERHEAD_BP.toLocaleString()} bp ITR/promoter/polyA
          overhead)
        </span>
      </div>

      {alternatives.length > 0 && (
        <div
          className="text-muted-foreground type-micro flex flex-wrap items-center gap-1.5"
          title="Next balanced WGGW-capable candidates — adjust to these in the design tool if the best one doesn't fit AAV."
        >
          <span>Alternatives:</span>
          {alternatives.map((c, i) => (
            <span
              key={c.position}
              className="rounded-sm border px-1.5 py-0.5 font-mono tabular-nums"
              title={`${c.motif} at bp ${c.position.toLocaleString()} · 5′ ${c.fivePrimeLength.toLocaleString()} bp / 3′ ${c.threePrimeLength.toLocaleString()} bp · ${c.distanceFromCenter.toLocaleString()} bp from center`}
            >
              #{i + 2} {c.motif}@{c.position.toLocaleString()}
              {!c.bothFit && (
                <span
                  className="text-danger-soft ml-1"
                  title="One fragment + AAV overhead exceeds ~4,700 bp"
                >
                  ⚠
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

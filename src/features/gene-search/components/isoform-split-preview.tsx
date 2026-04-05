'use client'

import { useMemo } from 'react'
import { Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  rankWggwByBalance,
  assessFragmentBalance,
} from '@/lib/bio/sequence-utils'
import { AAV_OVERHEAD_BP, AAV_PACKAGING_LIMIT } from '@/lib/bio/aav'
import { SplitBar } from '@/components/bio/split-bar'

interface IsoformSplitPreviewProps {
  codingSequence: string
  codingSequenceLength: number
}

const BALANCE_CLASS = {
  balanced: 'text-emerald-600 dark:text-emerald-400',
  moderate: 'text-amber-600 dark:text-amber-400',
  imbalanced: 'text-red-600 dark:text-red-400',
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
    const ranked = rankWggwByBalance(codingSequence)
    if (ranked.length === 0) return null
    const best = ranked[0]
    const balance = assessFragmentBalance(best.position, codingSequenceLength)
    const fiveAavTotal = best.fivePrimeLength + AAV_OVERHEAD_BP
    const threeAavTotal = best.threePrimeLength + AAV_OVERHEAD_BP
    const fiveFits = fiveAavTotal <= AAV_PACKAGING_LIMIT
    const threeFits = threeAavTotal <= AAV_PACKAGING_LIMIT
    return {
      best,
      balance,
      fiveAavTotal,
      threeAavTotal,
      fiveFits,
      threeFits,
    }
  }, [codingSequence, codingSequenceLength])

  if (preview === null) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Scissors className="size-3.5" />
        No WGGW motifs found — this sequence cannot be split by REJ.
      </div>
    )
  }

  const { best, balance, fiveAavTotal, threeAavTotal, fiveFits, threeFits } =
    preview

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs">
        <Scissors className="size-3.5" />
        <span className="text-muted-foreground">Best REJ split:</span>
        <span className="font-mono tabular-nums">{best.motif}</span>
        <span className="text-muted-foreground">at bp</span>
        <span className="tabular-nums">{best.position.toLocaleString()}</span>
        <span className={cn('font-medium', BALANCE_CLASS[balance])}>
          ({BALANCE_LABEL[balance]})
        </span>
      </div>

      <SplitBar
        fivePrimeLength={best.fivePrimeLength}
        threePrimeLength={best.threePrimeLength}
      />

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] tabular-nums">
        <span>
          5′ AAV: {fiveAavTotal.toLocaleString()} bp{' '}
          <span
            className={
              fiveFits
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }
          >
            ({fiveFits ? 'fits' : 'over limit'})
          </span>
        </span>
        <span>
          3′ AAV: {threeAavTotal.toLocaleString()} bp{' '}
          <span
            className={
              threeFits
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }
          >
            ({threeFits ? 'fits' : 'over limit'})
          </span>
        </span>
        <span className="opacity-70">
          (includes {AAV_OVERHEAD_BP.toLocaleString()} bp ITR/promoter/polyA
          overhead)
        </span>
      </div>
    </div>
  )
}

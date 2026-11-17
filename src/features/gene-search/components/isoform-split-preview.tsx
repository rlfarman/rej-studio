'use client'

import { Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  rankInducibleWggwByBalance,
  assessFragmentBalance,
} from '@/lib/bio/sequence-utils'
import { AAV_OVERHEAD_BP, AAV_PACKAGING_LIMIT } from '@/lib/bio/aav'
import { SplitBar } from '@/components/bio/split-bar'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.splitPreview

interface IsoformSplitPreviewProps {
  codingSequence: string
  codingSequenceLength: number
}

const BALANCE_CLASS = {
  balanced: 'text-success-soft',
  moderate: 'text-warning-soft',
  imbalanced: 'text-danger-soft',
} as const

function fitsAav(fragmentLength: number) {
  return fragmentLength + AAV_OVERHEAD_BP <= AAV_PACKAGING_LIMIT
}

function splitPreview(codingSequence: string, codingSequenceLength: number) {
  const ranked = rankInducibleWggwByBalance(codingSequence)
  if (ranked.length === 0) return null
  const best = ranked[0]
  const balance = assessFragmentBalance(best.position, codingSequenceLength)
  const fiveFits = fitsAav(best.fivePrimeLength)
  const threeFits = fitsAav(best.threePrimeLength)
  // Surface 2 alternatives only when the best candidate is suboptimal —
  // either not balanced, or one of its fragments won't fit in an AAV.
  // When #1 is balanced and both-fits, the alternatives are just noise.
  const showAlternatives = balance !== 'balanced' || !fiveFits || !threeFits
  const alternatives = showAlternatives
    ? ranked.slice(1, 3).map((c) => ({
        ...c,
        bothFit: fitsAav(c.fivePrimeLength) && fitsAav(c.threePrimeLength),
      }))
    : []
  return {
    best,
    balance,
    fiveAavTotal: best.fivePrimeLength + AAV_OVERHEAD_BP,
    threeAavTotal: best.threePrimeLength + AAV_OVERHEAD_BP,
    fiveFits,
    threeFits,
    alternatives,
  }
}

export function IsoformSplitPreview({
  codingSequence,
  codingSequenceLength,
}: IsoformSplitPreviewProps) {
  const preview = splitPreview(codingSequence, codingSequenceLength)

  if (preview === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Scissors className="size-3.5" />
        {copy.none}
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
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Scissors className="size-3.5" />
        <span className="text-muted-foreground">{copy.bestSplit}</span>
        <span className="font-mono tabular-nums">{best.motif}</span>
        <span className="text-muted-foreground">{copy.atBp}</span>
        <span className="tabular-nums">{best.position.toLocaleString()}</span>
        {!best.alreadyPresent && (
          <span className="text-muted-foreground">
            {copy.inducible(best.baseChanges)}
          </span>
        )}
        <span className={cn('font-medium', BALANCE_CLASS[balance])}>
          ({copy.balance[balance]})
        </span>
      </div>

      <SplitBar
        fivePrimeLength={best.fivePrimeLength}
        threePrimeLength={best.threePrimeLength}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 type-micro text-muted-foreground tabular-nums">
        <span>
          {copy.fragment('5′', fiveAavTotal.toLocaleString())}{' '}
          <span className={fiveFits ? 'text-success-soft' : 'text-danger-soft'}>
            ({fiveFits ? copy.fits : copy.overLimit})
          </span>
        </span>
        <span>
          {copy.fragment('3′', threeAavTotal.toLocaleString())}{' '}
          <span
            className={threeFits ? 'text-success-soft' : 'text-danger-soft'}
          >
            ({threeFits ? copy.fits : copy.overLimit})
          </span>
        </span>
        {/* Plain muted text: dimming it further fell below 4.5:1. */}
        <span>{copy.overhead(AAV_OVERHEAD_BP.toLocaleString())}</span>
      </div>

      {alternatives.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 type-micro text-muted-foreground"
          title={copy.alternativesHint}
        >
          <span>{copy.alternatives}</span>
          {alternatives.map((c, i) => (
            <span
              key={c.position}
              className="rounded-full border px-1.5 py-0.5 font-mono tabular-nums"
              title={copy.alternativeTitle(
                c.motif,
                c.position.toLocaleString(),
                c.fivePrimeLength.toLocaleString(),
                c.threePrimeLength.toLocaleString(),
                c.distanceFromCenter.toLocaleString(),
              )}
            >
              #{i + 2} {c.motif}@{c.position.toLocaleString()}
              {!c.bothFit && (
                <span
                  className="ml-1 text-danger-soft"
                  title={copy.overLimitHint}
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

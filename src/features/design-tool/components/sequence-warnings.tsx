'use client'
import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { TriangleAlert, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormValues } from '../types/form-schema'

/** Typical AAV packaging capacity in bases (excluding ITRs, promoter, polyA). */
const AAV_PRACTICAL_LIMIT_BP = 4700

interface Warning {
  key: string
  level: 'warn' | 'info'
  message: string
}

function computeWarnings(
  seq: string,
  spliceJunctionPosition: number,
  stim5: boolean,
  stim3: boolean,
): Warning[] {
  const warnings: Warning[] = []
  if (!seq || seq.length < 3) return warnings

  const len = seq.length

  // --- Protein summary (info) ---
  const proteinLength = Math.floor(len / 3) - 1 // exclude stop codon
  if (proteinLength > 0) {
    warnings.push({
      key: 'protein-summary',
      level: 'info',
      message: `Encodes a ${proteinLength.toLocaleString()} amino acid protein (${len.toLocaleString()} bp CDS).`,
    })
  }

  // --- AAV packaging warnings ---
  // Estimate overhead per AAV: ~290bp ITRs + ~800bp promoter/polyA + ~150bp stim intron
  const overheadPerVector = 290 + 800 + (stim5 || stim3 ? 150 : 0)
  const fivePrimeFragment = spliceJunctionPosition
  const threePrimeFragment = len - spliceJunctionPosition
  const fivePrimeTotal = fivePrimeFragment + overheadPerVector
  const threePrimeTotal = threePrimeFragment + overheadPerVector

  if (fivePrimeTotal > AAV_PRACTICAL_LIMIT_BP) {
    warnings.push({
      key: 'aav-5prime',
      level: 'warn',
      message: `5\u2032 fragment (~${fivePrimeTotal.toLocaleString()} bp with vector elements) exceeds typical AAV packaging capacity (~${AAV_PRACTICAL_LIMIT_BP.toLocaleString()} bp). Consider moving the splice junction downstream.`,
    })
  }

  if (threePrimeTotal > AAV_PRACTICAL_LIMIT_BP) {
    warnings.push({
      key: 'aav-3prime',
      level: 'warn',
      message: `3\u2032 fragment (~${threePrimeTotal.toLocaleString()} bp with vector elements) exceeds typical AAV packaging capacity (~${AAV_PRACTICAL_LIMIT_BP.toLocaleString()} bp). Consider moving the splice junction upstream.`,
    })
  }

  if (
    fivePrimeTotal <= AAV_PRACTICAL_LIMIT_BP &&
    threePrimeTotal <= AAV_PRACTICAL_LIMIT_BP &&
    len > AAV_PRACTICAL_LIMIT_BP
  ) {
    warnings.push({
      key: 'aav-total',
      level: 'info',
      message: `Total CDS (${len.toLocaleString()} bp) exceeds single-AAV capacity but fits within dual-AAV REJ split.`,
    })
  }

  // --- Splice junction proximity warning ---
  const minMargin = 150
  if (spliceJunctionPosition < minMargin && len > minMargin * 2) {
    warnings.push({
      key: 'splice-near-start',
      level: 'warn',
      message: `Splice junction is within ${minMargin} bp of the start codon. This leaves very little 5\u2032 fragment for stable expression.`,
    })
  }
  if (len - spliceJunctionPosition < minMargin && len > minMargin * 2) {
    warnings.push({
      key: 'splice-near-end',
      level: 'warn',
      message: `Splice junction is within ${minMargin} bp of the stop codon. This leaves very little 3\u2032 fragment for stable expression.`,
    })
  }

  // --- Sequence too short for meaningful split ---
  if (len < 300 && len >= 6) {
    warnings.push({
      key: 'short-cds',
      level: 'warn',
      message: `CDS is only ${len} bp. Sequences under 300 bp may not benefit from dual-AAV REJ splitting.`,
    })
  }

  return warnings
}

export function SequenceWarnings() {
  const { watch } = useFormContext<FormValues>()
  const seq = watch('codingSequence') ?? ''
  const spliceJunctionPosition = watch('spliceJunctionPosition') ?? 1
  const stim5 = watch('5PrimeStimulatoryIntron') ?? false
  const stim3 = watch('3PrimeStimulatoryIntron') ?? false

  const warnings = useMemo(
    () => computeWarnings(seq, spliceJunctionPosition, stim5, stim3),
    [seq, spliceJunctionPosition, stim5, stim3],
  )

  if (warnings.length === 0) return null

  return (
    <ul
      className="mt-2 space-y-1.5"
      role="status"
      aria-label="Sequence warnings"
    >
      {warnings.map((w) => (
        <li
          key={w.key}
          className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed',
            w.level === 'warn'
              ? 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200'
              : 'border-border bg-muted text-muted-foreground',
          )}
        >
          {w.level === 'warn' ? (
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <Info className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>{w.message}</span>
        </li>
      ))}
    </ul>
  )
}

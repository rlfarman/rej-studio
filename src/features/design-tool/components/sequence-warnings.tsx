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

function computeWarnings(seq: string): Warning[] {
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

  // --- Dual-AAV capacity info (sequence-length only) ---
  if (len > AAV_PRACTICAL_LIMIT_BP) {
    warnings.push({
      key: 'aav-total',
      level: 'info',
      message: `Total CDS (${len.toLocaleString()} bp) exceeds single-AAV capacity. Dual-AAV REJ split required.`,
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

  const warnings = useMemo(() => computeWarnings(seq), [seq])

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

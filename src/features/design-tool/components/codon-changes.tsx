'use client'

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  toCodons,
  translateCodon,
  AMINO_ACID_NAMES,
} from '@/lib/bio/genetic-code'

interface Props {
  original: string
  optimized: string
  splitPoint?: number
}

interface CodonChange {
  index: number // codon index (0-based)
  position: number // nucleotide position (1-based, start of codon)
  from: string
  to: string
  aaFrom: string | null
  aaTo: string | null
  synonymous: boolean
}

function analyze(original: string, optimized: string) {
  const origCodons = toCodons(original)
  const optCodons = toCodons(optimized)
  const len = Math.min(origCodons.length, optCodons.length)
  const changes: CodonChange[] = []
  let synonymous = 0
  let nonSynonymous = 0

  for (let i = 0; i < len; i++) {
    const from = origCodons[i].toUpperCase().replace(/U/g, 'T')
    const to = optCodons[i].toUpperCase().replace(/U/g, 'T')
    if (from === to) continue
    const aaFrom = translateCodon(from)
    const aaTo = translateCodon(to)
    const syn = aaFrom !== null && aaFrom === aaTo
    if (syn) synonymous++
    else nonSynonymous++
    changes.push({
      index: i,
      position: i * 3 + 1,
      from,
      to,
      aaFrom,
      aaTo,
      synonymous: syn,
    })
  }
  return { changes, total: len, synonymous, nonSynonymous }
}

export function CodonChanges({ original, optimized, splitPoint }: Props) {
  const { changes, total, synonymous, nonSynonymous } = useMemo(
    () => analyze(original, optimized),
    [original, optimized],
  )

  if (total === 0) return null

  const allSynonymous = nonSynonymous === 0
  const splitCodonIndex =
    splitPoint !== undefined ? Math.floor(splitPoint / 3) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2 text-[10px]">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-medium tabular-nums',
              allSynonymous
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {synonymous} synonymous
          </span>
          {nonSynonymous > 0 && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-700 tabular-nums dark:text-red-300">
              {nonSynonymous} non-synonymous
            </span>
          )}
          <span className="text-muted-foreground tabular-nums">
            of {total.toLocaleString()} codons
          </span>
        </div>
      </div>

      {/* Translation conservation strip */}
      <div className="space-y-1">
        <div className="text-muted-foreground text-[10px]">
          Translation conservation
        </div>
        <div
          className="relative h-2 overflow-hidden rounded-full border bg-emerald-500/70"
          role="img"
          aria-label={
            allSynonymous
              ? 'Protein sequence fully preserved'
              : `${nonSynonymous} non-synonymous changes detected`
          }
        >
          {!allSynonymous &&
            changes.map((c) =>
              c.synonymous ? null : (
                <div
                  key={c.index}
                  title={`Codon ${c.index + 1}: ${c.aaFrom ?? '?'} → ${c.aaTo ?? '?'}`}
                  className="absolute inset-y-0 bg-red-500"
                  style={{
                    left: `${(c.index / total) * 100}%`,
                    width: `${Math.max(0.2, 100 / total)}%`,
                  }}
                />
              ),
            )}
        </div>
        <div className="text-muted-foreground text-[10px]">
          {allSynonymous
            ? 'All changes are synonymous — protein sequence is preserved.'
            : `${nonSynonymous} non-synonymous substitution(s) — protein sequence has changed.`}
        </div>
      </div>

      {changes.length > 0 && (
        <details className="group">
          <summary className="text-muted-foreground cursor-pointer text-xs hover:underline">
            Show codon-by-codon diff ({changes.length})
          </summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-md border">
            <table className="w-full min-w-[32rem] text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th
                    scope="col"
                    className="text-muted-foreground px-2 py-1.5 font-medium"
                  >
                    #
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-2 py-1.5 font-medium"
                  >
                    bp
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-2 py-1.5 font-medium"
                  >
                    Change
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-2 py-1.5 font-medium"
                  >
                    Amino acid
                  </th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => {
                  const isSplit =
                    splitCodonIndex !== null && c.index === splitCodonIndex
                  return (
                    <tr
                      key={c.index}
                      className={cn(
                        'border-t',
                        isSplit && 'bg-primary/5',
                        !c.synonymous &&
                          'bg-red-500/5 text-red-700 dark:text-red-300',
                      )}
                    >
                      <td className="text-muted-foreground px-2 py-1 tabular-nums">
                        {c.index + 1}
                      </td>
                      <td className="text-muted-foreground px-2 py-1 tabular-nums">
                        {c.position.toLocaleString()}
                      </td>
                      <td className="px-2 py-1 font-mono">
                        <span className="text-muted-foreground">{c.from}</span>
                        <ArrowRight className="mx-1 inline size-2.5" />
                        <span className="font-medium">{c.to}</span>
                      </td>
                      <td className="px-2 py-1">
                        {c.aaFrom === c.aaTo ? (
                          <span className="text-muted-foreground">
                            {AMINO_ACID_NAMES[c.aaFrom ?? ''] ?? c.aaFrom} (=)
                          </span>
                        ) : (
                          <span className="font-medium">
                            {AMINO_ACID_NAMES[c.aaFrom ?? ''] ?? c.aaFrom}
                            <ArrowRight className="mx-1 inline size-2.5" />
                            {AMINO_ACID_NAMES[c.aaTo ?? ''] ?? c.aaTo}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}

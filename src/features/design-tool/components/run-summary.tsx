'use client'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormValues } from '../types/form-schema'
import { designToolCopy } from '../copy'
import { summarizeObjectives } from '../utils/objectives-summary'

const copy = designToolCopy.form.runSummary

/**
 * One line in the sticky action bar saying what pressing Run will do.
 *
 * The objectives are collapsed to a summary by default, so without this the
 * action bar would ask for a decision with nothing on screen to base it on.
 */
export function RunSummary() {
  const { control } = useFormContext<FormValues>()
  const values = useWatch({ control }) as Partial<FormValues>

  const sequence =
    values.sequenceType === 'protein'
      ? (values.proteinSequence ?? '')
      : (values.codingSequence ?? '')

  if (sequence.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.noSequence}</p>
  }

  const { count } = summarizeObjectives({
    species: values.species ?? 'none',
    removeCrypticSpliceSites: values.removeCrypticSpliceSites ?? false,
    minimizeCpgs: values.minimizeCpgs ?? false,
    reduceKmerComplexity: values.reduceKmerComplexity ?? false,
    enforceGcContent: values.enforceGcContent ?? false,
    '5PrimeStimulatoryIntron': values['5PrimeStimulatoryIntron'] ?? false,
    '3PrimeStimulatoryIntron': values['3PrimeStimulatoryIntron'] ?? false,
    codonOptimizeWeight: values.codonOptimizeWeight ?? 1,
    removeCrypticSpliceSitesWeight: values.removeCrypticSpliceSitesWeight ?? 1,
    minimizeCpgsWeight: values.minimizeCpgsWeight ?? 1,
    reduceKmerComplexityWeight: values.reduceKmerComplexityWeight ?? 1,
  })

  // Protein input is reverse-translated before submission, so only a DNA
  // sequence has a split point to report yet.
  const splitPoint =
    values.sequenceType === 'protein'
      ? null
      : (values.spliceJunctionPositions?.[0] ?? null)

  return (
    <p className="min-w-0 text-sm text-muted-foreground">
      {copy.ready(sequence.length.toLocaleString(), count)}
      {splitPoint !== null && (
        <> · {copy.splitAt(splitPoint.toLocaleString())}</>
      )}
    </p>
  )
}

import { useFormContext, useWatch } from 'react-hook-form'
import { FormValues } from '../types/form-schema'
import { designToolCopy } from '../copy'
import { summarizeObjectives } from '../utils/objectives-summary'
import { AAV_MAX_BP } from './splice-slider/constants'

const copy = designToolCopy.form.runSummary
const units = designToolCopy.units

/**
 * The longest fragment the split points cut the sequence into, or null when
 * there is no sequence to cut.
 *
 * Lengths only — the split-point editor resolves each cut to the nearest WGGW
 * site, and rescanning the sequence for those here would run on every
 * keystroke.
 */
function longestFragmentBp(
  sequenceLength: number,
  positions: number[],
): number | null {
  if (sequenceLength === 0) return null
  const cuts = [...positions]
    .filter((p) => p > 0 && p < sequenceLength)
    .sort((a, b) => a - b)
  let longest = 0
  let previous = 0
  for (const cut of [...cuts, sequenceLength]) {
    longest = Math.max(longest, cut - previous)
    previous = cut
  }
  return longest
}

/**
 * One line in the sticky action bar saying what pressing Run will do.
 *
 * The objectives are collapsed to a summary by default, so without this the
 * action bar would ask for a decision with nothing on screen to base it on.
 */
export function RunSummary() {
  const { control } = useFormContext<FormValues>()
  const values = useWatch({ control }) as Partial<FormValues>

  const isProtein = values.sequenceType === 'protein'
  const dna = values.codingSequence ?? ''
  const protein = values.proteinSequence ?? ''

  if ((isProtein ? protein : dna).length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.noSequence}</p>
  }

  // Protein input is designed as the DNA it reverse-translates to, so report
  // that length once it has arrived; until then the only honest count is the
  // residues on screen — never "bp", which they are not.
  const reportDnaLength = !isProtein || dna.length > 0
  const length = reportDnaLength ? dna.length : protein.length
  const unit = reportDnaLength ? units.bp : units.residues

  const { count, intronCount } = summarizeObjectives({
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
  const positions = values.spliceJunctionPositions ?? []
  const splitPoint = isProtein ? null : (positions[0] ?? null)

  // Each fragment travels in its own AAV, so the longest one is what decides
  // whether the design packages at all.
  const longestFragment = isProtein
    ? null
    : longestFragmentBp(dna.length, positions)
  const overAavLimit = longestFragment !== null && longestFragment > AAV_MAX_BP

  return (
    <p className="min-w-0 text-sm text-muted-foreground">
      {copy.ready(length.toLocaleString(), unit, count)}
      {intronCount > 0 && <> · {copy.introns(intronCount)}</>}
      {splitPoint !== null && (
        <> · {copy.splitAt(splitPoint.toLocaleString())}</>
      )}
      {overAavLimit && (
        <>
          {' · '}
          <span className="text-warning-soft">
            {copy.overAavLimit(
              longestFragment.toLocaleString(),
              AAV_MAX_BP.toLocaleString(),
            )}
          </span>
        </>
      )}
    </p>
  )
}

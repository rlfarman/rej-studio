import { designToolCopy } from '../copy'
import type { FormValues } from '../types/form-schema'

const copy = designToolCopy.optimizationOptions.summary

/** The fields the objectives summary reads. */
export type ObjectiveValues = Pick<
  FormValues,
  | 'species'
  | 'removeCrypticSpliceSites'
  | 'minimizeCpgs'
  | 'reduceKmerComplexity'
  | 'enforceGcContent'
  | '5PrimeStimulatoryIntron'
  | '3PrimeStimulatoryIntron'
  | 'codonOptimizeWeight'
  | 'removeCrypticSpliceSitesWeight'
  | 'minimizeCpgsWeight'
  | 'reduceKmerComplexityWeight'
>

/** Every objective weight defaults to 1 — equal weighting. */
const DEFAULT_WEIGHT = 1

interface ObjectivesSummary {
  /** Human-readable list of what's enabled, in form order. */
  items: string[]
  /** How many objectives the designer will apply. */
  count: number
  /**
   * True when the toggles and weights are untouched, so the summary can say
   * "Recommended settings" rather than "Custom settings". Species is excluded:
   * it has no recommended value (a blank form has none; an isoform supplies
   * one), so picking a species doesn't make the rest custom.
   */
  isDefault: boolean
}

export function summarizeObjectives(
  values: ObjectiveValues,
): ObjectivesSummary {
  const items: string[] = []

  if (values.species === 'human') items.push(copy.items.codonHuman)
  if (values.species === 'mouse') items.push(copy.items.codonMouse)
  if (values.removeCrypticSpliceSites) items.push(copy.items.spliceSites)
  if (values.minimizeCpgs) items.push(copy.items.cpg)
  if (values.reduceKmerComplexity) items.push(copy.items.kmer)
  if (values.enforceGcContent) items.push(copy.items.gc)

  const five = values['5PrimeStimulatoryIntron']
  const three = values['3PrimeStimulatoryIntron']
  if (five && three) items.push(copy.items.intronsBoth)
  else if (five) items.push(copy.items.intron5)
  else if (three) items.push(copy.items.intron3)

  const togglesAtDefault =
    values.removeCrypticSpliceSites &&
    values.minimizeCpgs &&
    values.reduceKmerComplexity &&
    values.enforceGcContent &&
    five &&
    three

  const weightsAtDefault = [
    values.codonOptimizeWeight,
    values.removeCrypticSpliceSitesWeight,
    values.minimizeCpgsWeight,
    values.reduceKmerComplexityWeight,
  ].every((weight) => weight === DEFAULT_WEIGHT)

  return {
    items,
    // Introns are placement options rather than optimizer objectives, so the
    // run summary counts only the objectives the designer scores against.
    count: items.filter(
      (item) =>
        item !== copy.items.intronsBoth &&
        item !== copy.items.intron5 &&
        item !== copy.items.intron3,
    ).length,
    isDefault: togglesAtDefault && weightsAtDefault,
  }
}

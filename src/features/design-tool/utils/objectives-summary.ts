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
   * How many stimulatory introns will be placed. Reported separately because
   * `count` deliberately excludes them: the summary lists them beside the
   * objectives, so without this the line beneath it reads as though two of
   * the things listed had been lost.
   */
  intronCount: number
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
  // Named rather than omitted: species is what switches codon optimization
  // on, and a blank form has none, so "Recommended settings" would otherwise
  // present a set with its headline objective missing as though complete.
  if (values.species === 'none') items.push(copy.items.codonOff)
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

  // Counted from the values, not by filtering the rendered list: introns are
  // placement rather than scored objectives, and "codon usage off" is the
  // absence of one, so a list-subtraction count silently miscounts the moment
  // a non-objective is added to `items`.
  const scored = [
    values.species !== 'none',
    values.removeCrypticSpliceSites,
    values.minimizeCpgs,
    values.reduceKmerComplexity,
    values.enforceGcContent,
  ].filter(Boolean).length

  return {
    items,
    count: scored,
    intronCount: (five ? 1 : 0) + (three ? 1 : 0),
    isDefault: togglesAtDefault && weightsAtDefault,
  }
}

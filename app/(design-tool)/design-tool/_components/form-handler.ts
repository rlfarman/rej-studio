import type { FormValues } from './form-schema'

export function buildJobParams(values: FormValues) {
  return {
    CDS: values.codingSequence,
    name: values.name,
    options: buildOptions(values),
  }
}

function buildOptions(values: FormValues) {
  return {
    codon_optimize: values.species !== 'none' ? values.species : null,
    codon_optimize_weight: values.codonOptimizeWeight,
    remove_cryptic_ss: values.removeCrypticSpliceSites,
    remove_cryptic_ss_weight: values.removeCrypticSpliceSitesWeight,
    minimize_CpGs: values.minimizeCpgs,
    minimize_CpGs_weight: values.minimizeCpgsWeight,
    reduce_kmer_complexity: values.reduceKmerComplexity,
    reduce_kmer_complexity_weight: values.reduceKmerComplexityWeight,
    enforce_gc: values.enforceGcContent,
    stim_5: values['5PrimeStimulatoryIntron'],
    stim_3: values['3PrimeStimulatoryIntron'],
    split_point: values.spliceJunctionPosition,
    ensure_wggw: true,
    wggw_threshold: 300,
  }
}

/** Serialize the options dict as a human-readable string for the report. */
export function formatOptionsForReport(values: FormValues): string {
  return JSON.stringify(buildOptions(values), null, 2)
}

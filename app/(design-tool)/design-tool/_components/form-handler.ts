import type { FormValues } from './form-schema'
import type { ProcessResult } from '@/design-tool/types/process-result'

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

export async function submitFormJson(
  values: FormValues,
): Promise<ProcessResult> {
  const response = await fetch('/api/py/process-json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      CDS: values.codingSequence,
      name: values.name,
      options: buildOptions(values),
    }),
  })

  if (!response.ok) {
    let detail = 'Something went wrong while processing your sequence.'
    try {
      const body = await response.json()
      if (body.detail) detail = body.detail
    } catch {}
    throw new Error(detail)
  }

  return response.json()
}

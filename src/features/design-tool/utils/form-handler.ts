import type { FormValues, SelectedWggwSite } from '../types/form-schema'
import type { ProcessOptions } from '../types/optimizer-contract'

export function buildJobParams(values: FormValues) {
  return {
    CDS: values.codingSequence,
    name: values.name,
    options: buildOptions(values),
  }
}

function buildOptions(values: FormValues): ProcessOptions {
  const positions = values.spliceJunctionPositions
  const sites = values.selectedWggwSites
  // One split point, always: the optimizer takes a single `split_point`
  // (ProcessOptions in rust/optimizer/src/contract.rs), and the form schema
  // blocks a second position before we get here.
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
    split_point: positions[0] ?? null,
    selected_wggw_site: serializeSelectedWggwSite(sites[0] ?? null),
    ensure_wggw: true,
    wggw_threshold: 300,
  }
}

/** Uppercase DNA, with RNA U folded back to T — the optimizer expects DNA. */
function toDna(codon: string) {
  return codon.toUpperCase().replace(/U/g, 'T')
}

function serializeSelectedWggwSite(site: SelectedWggwSite | null | undefined) {
  if (!site) return null
  return {
    position: site.position,
    motif_start: site.motifStart,
    motif: toDna(site.motif),
    hexamer_start: site.hexamerStart,
    // Tuples, not arrays: the optimizer's SelectedWggwSiteInput takes exactly
    // two codons either side of the junction (rust/optimizer/src/contract.rs).
    original_codons: site.originalCodons.map(toDna) as [string, string],
    new_codons: site.newCodons.map(toDna) as [string, string],
    new_hexamer: toDna(site.newHexamer),
  }
}

/** Serialize the options dict as a human-readable string for the report. */
export function formatOptionsForReport(values: FormValues): string {
  return JSON.stringify(buildOptions(values), null, 2)
}

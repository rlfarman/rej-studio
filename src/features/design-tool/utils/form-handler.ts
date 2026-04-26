import type { FormValues, SelectedWggwSite } from '../types/form-schema'

export function buildJobParams(values: FormValues) {
  return {
    CDS: values.codingSequence,
    name: values.name,
    options: buildOptions(values),
  }
}

function buildOptions(values: FormValues) {
  const positions = values.spliceJunctionPositions
  const sites = values.selectedWggwSites
  // Backwards-compat: emit single split_point / selected_wggw_site for the
  // common 1-splice case so the existing Python backend keeps working
  // without changes. For 2+ splices, also emit array forms.
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
    ...(positions.length > 1 && {
      split_points: positions,
      selected_wggw_sites: sites.map(serializeSelectedWggwSite),
    }),
    ensure_wggw: true,
    wggw_threshold: 300,
  }
}

function serializeSelectedWggwSite(site: SelectedWggwSite | null | undefined) {
  if (!site) return null
  return {
    position: site.position,
    motif_start: site.motifStart,
    motif: site.motif.toUpperCase().replace(/U/g, 'T'),
    hexamer_start: site.hexamerStart,
    original_codons: site.originalCodons.map((codon) =>
      codon.toUpperCase().replace(/U/g, 'T'),
    ),
    new_codons: site.newCodons.map((codon) =>
      codon.toUpperCase().replace(/U/g, 'T'),
    ),
    new_hexamer: site.newHexamer.toUpperCase().replace(/U/g, 'T'),
  }
}

/** Serialize the options dict as a human-readable string for the report. */
export function formatOptionsForReport(values: FormValues): string {
  return JSON.stringify(buildOptions(values), null, 2)
}

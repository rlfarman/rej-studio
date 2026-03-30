import { toast } from 'sonner'
import { SpeciesValues } from '@/design-tool/types/species-options'
import { FormValues } from './form-schema'

export async function handleSubmitForm({
  codingSequence,
  name,
  species,
  codonOptimizeWeight,
  removeCrypticSpliceSites,
  removeCrypticSpliceSitesWeight,
  minimizeCpgs,
  minimizeCpgsWeight,
  reduceKmerComplexity,
  reduceKmerComplexityWeight,
  enforceGcContent,
  spliceJunctionPosition,
  '5PrimeStimulatoryIntron': stim5,
  '3PrimeStimulatoryIntron': stim3,
}: FormValues) {
  const toastId = toast.loading('Submitting your request...')
  const options = {
    codon_optimize:
      species !== SpeciesValues.None ? species.toLowerCase() : null,
    codon_optimize_weight: codonOptimizeWeight,
    remove_cryptic_ss: removeCrypticSpliceSites,
    remove_cryptic_ss_weight: removeCrypticSpliceSitesWeight,
    minimize_CpGs: minimizeCpgs,
    minimize_CpGs_weight: minimizeCpgsWeight,
    reduce_kmer_complexity: reduceKmerComplexity,
    reduce_kmer_complexity_weight: reduceKmerComplexityWeight,
    enforce_gc: enforceGcContent,
    stim_5: stim5,
    stim_3: stim3,
    split_point: spliceJunctionPosition,
    ensure_wggw: true, // Always ensure WGGW motif
    wggw_threshold: 300, // Default threshold for WGGW
  }
  try {
    // TODO: Re-enable job logging when user auth is implemented
    const response = await fetch('/api/py/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        CDS: codingSequence,
        name,
        options,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to process the request.')
    }

    // Download the resulting FileResponse
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    const safeName = name.replace(/[^a-zA-Z0-9_\-. ]/g, '_')
    a.download = `${safeName}.zip`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    a.remove()
    toast.success(
      'Sequence processed successfully! Your download will start shortly.',
      { id: toastId },
    )
  } catch (error) {
    toast.error('An error occurred while processing your request.', {
      id: toastId,
    })
    console.error('Error creating job:', error)
  }
}

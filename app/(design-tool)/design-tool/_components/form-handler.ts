import { toast } from 'sonner'
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
    codon_optimize: species !== 'none' ? species : null,
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
      let detail = 'Failed to process the request.'
      try {
        const body = await response.json()
        if (body.detail) detail = body.detail
      } catch {}
      throw new Error(detail)
    }

    // Download the resulting FileResponse
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    try {
      a.style.display = 'none'
      a.href = url
      const safeName = name.replace(/[^a-zA-Z0-9_\-. ]/g, '_')
      a.download = `${safeName}.zip`
      document.body.appendChild(a)
      a.click()
    } finally {
      a.remove()
      window.URL.revokeObjectURL(url)
    }
    toast.success(
      'Sequence processed successfully! Your download will start shortly.',
      { id: toastId },
    )
  } catch (error) {
    let message = 'An unexpected error occurred. Please try again.'
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      message =
        'Unable to reach the server. Please check your connection and try again.'
    } else if (error instanceof Error) {
      message = error.message
    }
    toast.error(message, { id: toastId })
    console.error('Error creating job:', error)
  }
}

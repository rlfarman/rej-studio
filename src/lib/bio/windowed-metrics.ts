/**
 * Sliding-window numeric tracks for the Gene Map viewer. All outputs are
 * Float32Array values in 0..1, one entry per `step` bases, suitable for
 * upload as a 1D R32F texture.
 */

import { findRestrictionSites } from './restriction-sites'

export interface WindowedTrack {
  /** 0..1 per bucket */
  values: Float32Array
  /** bases per bucket */
  step: number
  /** window length used */
  windowSize: number
}

/** GC fraction (0..1) per window. */
export function gcWindow(
  seq: string,
  windowSize = 32,
  step = 8,
): WindowedTrack {
  const upper = seq.toUpperCase()
  const n = upper.length
  const count = Math.max(1, Math.ceil(n / step))
  const values = new Float32Array(count)
  const half = Math.floor(windowSize / 2)

  for (let i = 0; i < count; i++) {
    const center = i * step
    const start = Math.max(0, center - half)
    const end = Math.min(n, center + half)
    let gc = 0
    for (let j = start; j < end; j++) {
      const c = upper[j]
      if (c === 'G' || c === 'C') gc++
    }
    const w = end - start
    values[i] = w > 0 ? gc / w : 0
  }
  return { values, step, windowSize }
}

/** CpG dinucleotide density (0..1) per window. */
export function cpgDensityWindow(
  seq: string,
  windowSize = 64,
  step = 8,
): WindowedTrack {
  const upper = seq.toUpperCase()
  const n = upper.length
  const count = Math.max(1, Math.ceil(n / step))
  const values = new Float32Array(count)
  const half = Math.floor(windowSize / 2)

  for (let i = 0; i < count; i++) {
    const center = i * step
    const start = Math.max(0, center - half)
    const end = Math.min(n, center + half)
    let cpg = 0
    for (let j = start; j < end - 1; j++) {
      if (upper[j] === 'C' && upper[j + 1] === 'G') cpg++
    }
    const w = Math.max(1, end - start - 1)
    // Cap at ~0.25 (theoretical max CpG density ≈ 1 per 4 bp), then scale to 0..1
    values[i] = Math.min(1, cpg / w / 0.25)
  }
  return { values, step, windowSize }
}

/**
 * Design-suitability heatmap: lower = better. Combines three penalties:
 *   - GC deviation from 50% (optimal codon design range ~40–60%)
 *   - CpG density (strong CpG clusters are harder to re-optimize)
 *   - Restriction-site density (common cut sites complicate cloning)
 * Returns values in 0..1 where 0 = excellent, 1 = poor.
 */
export function suitabilityHeatWindow(
  seq: string,
  windowSize = 120,
  step = 8,
): WindowedTrack {
  const gc = gcWindow(seq, windowSize, step).values
  const cpg = cpgDensityWindow(seq, windowSize, step).values

  const sites = findRestrictionSites(seq)
  const upper = seq.toUpperCase()
  const n = upper.length
  const count = Math.max(1, Math.ceil(n / step))
  const sitesPerBucket = new Float32Array(count)
  for (const s of sites) {
    const bucket = Math.min(count - 1, Math.floor((s.position - 1) / step))
    sitesPerBucket[bucket] += 1
  }

  const values = new Float32Array(count)
  const half = Math.floor(windowSize / 2 / step)
  for (let i = 0; i < count; i++) {
    // Smear restriction-site counts across the window.
    const lo = Math.max(0, i - half)
    const hi = Math.min(count, i + half)
    let siteSum = 0
    for (let j = lo; j < hi; j++) siteSum += sitesPerBucket[j]
    const sitePenalty = Math.min(1, siteSum / 3)

    const gcDev = Math.min(1, Math.abs(gc[i] - 0.5) / 0.3)
    const cpgPenalty = cpg[i]

    // Weighted blend, soft-clipped.
    const raw = 0.45 * gcDev + 0.35 * cpgPenalty + 0.2 * sitePenalty
    values[i] = Math.min(1, raw)
  }
  return { values, step, windowSize }
}

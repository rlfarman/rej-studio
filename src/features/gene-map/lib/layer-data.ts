import { codonToClassIndex } from './aa-classes'
import { findRestrictionSites } from '@/lib/bio/restriction-sites'
import type { LayerData } from '../types'

// Texture encoding, 1 pixel per base, packed RGBA8:
//   R = amino-acid class index for this base's codon (0..5)
//   G = bit flags:
//        bit 0: this base is part of a CpG pair (C in CG, or G in CG)
//        bit 1: this base is inside a restriction enzyme recognition site
//        bit 2: codon frame position 0 (first base of a codon)
//        bit 3: codon frame position 1
//        bit 4: codon frame position 2
//   B = rolling-window GC content (0..255 mapping to 0..100%)
//   A = base identity: 0=A, 1=C, 2=G, 3=T, 4=N/other

const BASE_A = 0
const BASE_C = 1
const BASE_G = 2
const BASE_T = 3
const BASE_N = 4

function baseCode(c: string): number {
  switch (c) {
    case 'A':
    case 'a':
      return BASE_A
    case 'C':
    case 'c':
      return BASE_C
    case 'G':
    case 'g':
      return BASE_G
    case 'T':
    case 't':
    case 'U':
    case 'u':
      return BASE_T
    default:
      return BASE_N
  }
}

/** Rolling GC window; 60bp matches slidingGcContent default elsewhere. */
const GC_WINDOW = 60

export function computeLayerData(sequence: string): LayerData {
  const upper = sequence.toUpperCase().replace(/U/g, 'T')
  const n = upper.length

  // WebGL2 has a minimum texture size support of 2048 but most GPUs handle
  // 16k. We pack into a 2D texture to stay well below any limit, even for
  // 20kbp+ sequences. Width is the next power of two up to 2048.
  const textureWidth = Math.min(
    2048,
    Math.max(256, nextPow2(Math.ceil(Math.sqrt(n)))),
  )
  const textureHeight = Math.max(1, Math.ceil(n / textureWidth))
  const data = new Uint8Array(textureWidth * textureHeight * 4)

  // Precompute codon aa-class, mapped back to every base in that codon.
  const codonClass = new Uint8Array(n)
  for (let i = 0; i + 3 <= n; i += 3) {
    const cls = codonToClassIndex(upper.slice(i, i + 3))
    codonClass[i] = cls
    codonClass[i + 1] = cls
    codonClass[i + 2] = cls
  }
  for (let i = n - (n % 3); i < n; i++) codonClass[i] = 5 // trailing → "stop" bucket

  // CpG: a base is marked if it participates in a CG dinucleotide.
  const cpgMask = new Uint8Array(n)
  for (let i = 0; i + 1 < n; i++) {
    if (upper[i] === 'C' && upper[i + 1] === 'G') {
      cpgMask[i] = 1
      cpgMask[i + 1] = 1
    }
  }

  // Restriction sites: mark every base inside any hit.
  const restMask = new Uint8Array(n)
  const hits = findRestrictionSites(upper)
  for (const h of hits) {
    const start = h.position - 1
    const end = start + h.site.length
    for (let i = start; i < end && i < n; i++) restMask[i] = 1
  }

  // Rolling GC via incremental window.
  const gc = new Uint8Array(n)
  let gcCount = 0
  const half = Math.floor(GC_WINDOW / 2)
  for (let i = 0; i < Math.min(GC_WINDOW, n); i++) {
    if (upper[i] === 'G' || upper[i] === 'C') gcCount++
  }
  for (let i = 0; i < n; i++) {
    const center = i
    const lo = Math.max(0, center - half)
    const hi = Math.min(n, center + half)
    // Recompute on window shift; simple & O(n*window) is fine at this scale.
    let count = 0
    for (let j = lo; j < hi; j++) {
      const c = upper[j]
      if (c === 'G' || c === 'C') count++
    }
    const width = hi - lo
    gc[i] = width > 0 ? Math.round((count / width) * 255) : 0
  }
  void gcCount // keep for possible future incremental version

  // Pack into RGBA8.
  for (let i = 0; i < n; i++) {
    const off = i * 4
    const framePos = i % 3
    const flags =
      (cpgMask[i] & 1) |
      ((restMask[i] & 1) << 1) |
      (framePos === 0 ? 1 << 2 : 0) |
      (framePos === 1 ? 1 << 3 : 0) |
      (framePos === 2 ? 1 << 4 : 0)
    data[off + 0] = codonClass[i]
    data[off + 1] = flags
    data[off + 2] = gc[i]
    data[off + 3] = baseCode(upper[i])
  }
  // Remaining texels default to zero — safe because our vertex shader clamps
  // instance IDs to sequence length.

  return { length: n, texture: data, textureWidth, textureHeight }
}

function nextPow2(x: number): number {
  let p = 1
  while (p < x) p <<= 1
  return p
}

/**
 * Downsampled per-position aa-class array for the minimap (2D canvas).
 * Returns one class index per output column.
 */
export function downsampleAaClass(
  sequence: string,
  columns: number,
): Uint8Array {
  const upper = sequence.toUpperCase().replace(/U/g, 'T')
  const n = upper.length
  const out = new Uint8Array(columns)
  if (n === 0) return out
  const step = n / columns
  // For each output column, vote over its bp span (majority class).
  for (let c = 0; c < columns; c++) {
    const lo = Math.floor(c * step)
    const hi = Math.max(lo + 1, Math.floor((c + 1) * step))
    const counts = new Uint16Array(6)
    // Snap to codon frame so the majority is meaningful.
    const alignedLo = lo - (lo % 3)
    for (let i = alignedLo; i + 3 <= hi && i + 3 <= n; i += 3) {
      counts[codonToClassIndex(upper.slice(i, i + 3))]++
    }
    let best = 0
    let bestCount = counts[0]
    for (let k = 1; k < 6; k++) {
      if (counts[k] > bestCount) {
        best = k
        bestCount = counts[k]
      }
    }
    out[c] = best
  }
  return out
}

/** Pure functions for client-side sequence analysis. */

export function computeGcPercent(seq: string): number {
  if (seq.length === 0) return 0
  const gc = [...seq].filter((c) => c === 'G' || c === 'C').length
  return (gc / seq.length) * 100
}

/**
 * Find all WGGW motif occurrences in a sequence. WGGW = [AT]GG[AT].
 * Returns 1-based positions of the first base of each motif.
 */
export function findWggwMotifs(
  seq: string,
): { position: number; motif: string }[] {
  if (seq.length < 4) return []
  const upper = seq.toUpperCase().replace(/U/g, 'T')
  const matches: { position: number; motif: string }[] = []
  const re = /[AT]GG[AT]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(upper)) !== null) {
    matches.push({ position: m.index + 1, motif: m[0] })
    // Advance by 1 to catch overlapping motifs (e.g. TGGT inside ATGGTA).
    re.lastIndex = m.index + 1
  }
  return matches
}

/**
 * Sliding-window GC content. Returns one point per `step` bases, centered on
 * the window. Windows at the edges are shortened to fit within the sequence.
 */
export function slidingGcContent(
  seq: string,
  windowSize = 60,
  step = 10,
): { position: number; gc: number }[] {
  if (seq.length === 0) return []
  const upper = seq.toUpperCase()
  const len = upper.length
  const half = Math.floor(windowSize / 2)
  const points: { position: number; gc: number }[] = []

  for (let center = 0; center < len; center += step) {
    const start = Math.max(0, center - half)
    const end = Math.min(len, center + half)
    let gc = 0
    for (let i = start; i < end; i++) {
      const c = upper[i]
      if (c === 'G' || c === 'C') gc++
    }
    const width = end - start
    points.push({ position: center, gc: width > 0 ? (gc / width) * 100 : 0 })
  }
  // Always include a final point at the exact sequence end
  if (points[points.length - 1]?.position !== len - 1) {
    const start = Math.max(0, len - 1 - half)
    let gc = 0
    for (let i = start; i < len; i++) {
      const c = upper[i]
      if (c === 'G' || c === 'C') gc++
    }
    points.push({
      position: len - 1,
      gc: len - start > 0 ? (gc / (len - start)) * 100 : 0,
    })
  }
  return points
}

/**
 * Density of per-position mismatches between two aligned sequences, bucketed
 * into `binCount` bins. Assumes equal-length sequences (synonymous rewrite).
 */
export function changeDensity(
  a: string,
  b: string,
  binCount = 40,
): { start: number; end: number; changes: number; binSize: number }[] {
  const len = Math.min(a.length, b.length)
  if (len === 0 || binCount <= 0) return []
  const binSize = Math.max(1, Math.ceil(len / binCount))
  const bins = Array.from({ length: Math.ceil(len / binSize) }, (_, i) => ({
    start: i * binSize,
    end: Math.min(len, (i + 1) * binSize),
    changes: 0,
    binSize,
  }))
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) bins[Math.floor(i / binSize)].changes++
  }
  return bins
}

export function hasStartCodon(seq: string): boolean {
  return seq.length >= 3 && seq.slice(0, 3).toUpperCase() === 'ATG'
}

const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA'])

export function getStopCodonStatus(seq: string): 'present' | 'absent' | 'none' {
  if (seq.length < 3) return 'none'
  const last3 = seq.slice(-3).toUpperCase()
  return STOP_CODONS.has(last3) ? 'present' : 'absent'
}

export function countCpG(seq: string): number {
  let count = 0
  const upper = seq.toUpperCase()
  for (let i = 0; i < upper.length - 1; i++) {
    if (upper[i] === 'C' && upper[i + 1] === 'G') count++
  }
  return count
}

export function findInvalidChars(seq: string): string[] {
  const invalid = new Set<string>()
  for (const c of seq) {
    if (!/[ACGTUacgtu]/.test(c)) invalid.add(c)
  }
  return [...invalid]
}

// ---------------------------------------------------------------------------
// Splice-junction helpers
// ---------------------------------------------------------------------------

/** Local GC % in a window centered on `position` (1-based cut). */
export function localGcAt(seq: string, position: number, window = 40): number {
  const len = seq.length
  if (len === 0) return 0
  const half = Math.floor(window / 2)
  const start = Math.max(0, position - half)
  const end = Math.min(len, position + half)
  let gc = 0
  const upper = seq.toUpperCase()
  for (let i = start; i < end; i++) {
    const c = upper[i]
    if (c === 'G' || c === 'C') gc++
  }
  const w = end - start
  return w > 0 ? (gc / w) * 100 : 0
}

export interface WggwCandidate {
  /** 1-based cut position at the motif midpoint (between bases 2 and 3). */
  position: number
  /** The matched WGGW tetramer (e.g. "TGGA"). */
  motif: string
  /** |position − seqLength/2|: distance from a 50/50 split, in bp. */
  distanceFromCenter: number
  /** 5' fragment length if the split is applied here. */
  fivePrimeLength: number
  /** 3' fragment length if the split is applied here. */
  threePrimeLength: number
}

/**
 * Return every WGGW motif in the sequence, ranked by proximity to a 50/50
 * fragment split. This is an explicit, single-criterion ranking — "of the
 * motifs that are actual REJ recognition substrates, which would produce
 * the most balanced halves?" — not a composite score.
 */
export function rankWggwByBalance(sequence: string): WggwCandidate[] {
  const len = sequence.length
  if (len < 4) return []
  const center = len / 2
  const motifs = findWggwMotifs(sequence)
  return motifs
    .map((m): WggwCandidate => {
      const cut = m.position + 1 // midpoint of the 4bp motif (1-based cut index)
      return {
        position: cut,
        motif: m.motif,
        distanceFromCenter: Math.abs(cut - center),
        fivePrimeLength: cut,
        threePrimeLength: len - cut,
      }
    })
    .sort((a, b) => a.distanceFromCenter - b.distanceFromCenter)
}

export function assessFragmentBalance(
  splitPosition: number,
  seqLength: number,
): 'balanced' | 'moderate' | 'imbalanced' {
  if (seqLength <= 0 || splitPosition <= 0) return 'balanced'
  const ratio = splitPosition / seqLength
  if (ratio >= 0.3 && ratio <= 0.7) return 'balanced'
  if (ratio >= 0.2 && ratio <= 0.8) return 'moderate'
  return 'imbalanced'
}

// ---------------------------------------------------------------------------
// Sequence highlighting
// ---------------------------------------------------------------------------

export type HighlightType =
  | 'start-codon'
  | 'missing-start'
  | 'stop-codon'
  | 'missing-stop'
  | 'invalid-char'
  | 'internal-stop'
  | 'remainder'
  | 'normal'

export interface SequenceSegment {
  text: string
  type: HighlightType
}

const STOP_CODONS_SET = new Set(['TAA', 'TAG', 'TGA', 'UAA', 'UAG', 'UGA'])

/**
 * Segments a coding sequence into runs of characters sharing the same
 * highlight type. Priority (highest wins): invalid char > internal stop >
 * start codon > stop codon > remainder > normal.
 */
export function segmentSequence(seq: string): SequenceSegment[] {
  if (seq.length === 0) return []

  const upper = seq.toUpperCase()
  const len = seq.length

  // 1. Default everything to normal
  const types: HighlightType[] = new Array(len).fill('normal')

  // 2. Mark remainder (trailing chars when not multiple of 3)
  const rem = len % 3
  if (rem > 0) {
    for (let i = len - rem; i < len; i++) types[i] = 'remainder'
  }

  // 3. Mark stop codon (last 3 chars, only when length is multiple of 3)
  if (len >= 3 && rem === 0) {
    const last3 = upper.slice(-3)
    const stopType: HighlightType = STOP_CODONS_SET.has(last3)
      ? 'stop-codon'
      : 'missing-stop'
    for (let i = len - 3; i < len; i++) types[i] = stopType
  }

  // 4. Mark start codon (first 3 chars)
  if (len >= 3) {
    const first3 = upper.slice(0, 3)
    const startType: HighlightType =
      first3 === 'ATG' || first3 === 'AUG' ? 'start-codon' : 'missing-start'
    for (let i = 0; i < 3; i++) types[i] = startType
  }

  // 5. Mark internal stop codons (reading frame, excluding first & last codon)
  const lastCodonStart = len - (rem === 0 ? 3 : rem)
  for (let i = 3; i < lastCodonStart; i += 3) {
    if (STOP_CODONS_SET.has(upper.slice(i, i + 3))) {
      for (let j = i; j < i + 3; j++) types[j] = 'internal-stop'
    }
  }

  // 6. Mark invalid characters (highest priority — overwrites everything)
  for (let i = 0; i < len; i++) {
    if (!/[ACGTUacgtu]/.test(seq[i])) types[i] = 'invalid-char'
  }

  // 7. Merge consecutive same-type characters into segments
  const segments: SequenceSegment[] = []
  let currentType = types[0]
  let start = 0

  for (let i = 1; i <= len; i++) {
    if (i === len || types[i] !== currentType) {
      segments.push({ text: seq.slice(start, i), type: currentType })
      if (i < len) {
        currentType = types[i]
        start = i
      }
    }
  }

  return segments
}

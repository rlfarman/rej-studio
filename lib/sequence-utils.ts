/** Pure functions for client-side sequence analysis. */

export function computeGcPercent(seq: string): number {
  if (seq.length === 0) return 0
  const gc = [...seq].filter((c) => c === 'G' || c === 'C').length
  return (gc / seq.length) * 100
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

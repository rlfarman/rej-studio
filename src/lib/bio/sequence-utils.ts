/** Pure functions for client-side sequence analysis. */

import { GENETIC_CODE, toCodons } from '@/lib/bio/genetic-code'

/**
 * Guess whether a pasted/uploaded sequence is DNA or protein.
 *
 * DNA alphabet (ACGTUN) overlaps with protein (A, C, G, T are also amino
 * acids), so the only reliable signal is protein-exclusive letters
 * (D, E, F, H, I, K, L, M, P, Q, R, S, V, W, Y). If any appear above a small
 * threshold we classify as protein; otherwise DNA.
 */
export function detectSequenceType(text: string): 'dna' | 'protein' {
  const seq = text
    .replace(/^>.*$/gm, '')
    .replace(/[\s\r\n]/g, '')
    .toUpperCase()
  if (seq.length === 0) return 'dna'
  const proteinOnly = seq.match(/[DEFHIKLMPQRSVWY]/g)?.length ?? 0
  // 1% guards against occasional stray letters in otherwise-valid DNA
  return proteinOnly / seq.length > 0.01 ? 'protein' : 'dna'
}

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

const WGGW_REGEX = /[AT]GG[AT]/g

export interface WggwRecodingOption {
  motif: string
  motifOffset: number
  splitOffset: number
  newHexamer: string
  newCodons: [string, string]
  baseChanges: number
}

export interface InducibleWggwCandidate {
  /** 1-based cut position at the motif midpoint (between bases 2 and 3). */
  position: number
  /** 1-based position of the first motif base in the CDS. */
  motifStart: number
  /** The WGGW tetramer produced at this junction. */
  motif: string
  /** 1-based position of the first base in the owning 6 nt codon-pair window. */
  hexamerStart: number
  /** 6 nt codon-pair window before recoding. */
  originalHexamer: string
  /** 6 nt codon-pair window after synonymous recoding. */
  newHexamer: string
  /** Current codons in the sequence. */
  originalCodons: [string, string]
  /** One synonymous codon pair that yields this candidate. */
  newCodons: [string, string]
  /** Whether the current sequence already contains this exact WGGW motif. */
  alreadyPresent: boolean
  /** Number of nucleotide substitutions needed for the primary rewrite. */
  baseChanges: number
  /** Alternative synonymous rewrites that yield the same candidate split. */
  rewriteOptions: WggwRecodingOption[]
}

function countBaseChanges(a: string, b: string): number {
  let changes = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) changes++
  }
  return changes
}

function findWggwWindows(seq: string): {
  motif: string
  motifOffset: number
  splitOffset: number
}[] {
  const matches: { motif: string; motifOffset: number; splitOffset: number }[] =
    []
  WGGW_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WGGW_REGEX.exec(seq)) !== null) {
    matches.push({
      motif: m[0],
      motifOffset: m.index,
      // 1-based cut position relative to the 6mer: WG|GW
      splitOffset: m.index + 2,
    })
    WGGW_REGEX.lastIndex = m.index + 1
  }
  return matches
}

const SYNONYMOUS_CODONS = Object.entries(GENETIC_CODE).reduce<
  Record<string, string[]>
>((acc, [codon, aa]) => {
  if (!acc[aa]) acc[aa] = []
  acc[aa].push(codon)
  return acc
}, {})

const WGGW_RECODING_LOOKUP = Object.entries(GENETIC_CODE).reduce<
  Record<string, WggwRecodingOption[]>
>((lookup, [codon1, aa1]) => {
  for (const [codon2, aa2] of Object.entries(GENETIC_CODE)) {
    const originalHexamer = `${codon1}${codon2}`
    const options: WggwRecodingOption[] = []

    for (const newCodon1 of SYNONYMOUS_CODONS[aa1] ?? []) {
      for (const newCodon2 of SYNONYMOUS_CODONS[aa2] ?? []) {
        const newHexamer = `${newCodon1}${newCodon2}`
        for (const match of findWggwWindows(newHexamer)) {
          options.push({
            ...match,
            newHexamer,
            newCodons: [newCodon1, newCodon2],
            baseChanges: countBaseChanges(originalHexamer, newHexamer),
          })
        }
      }
    }

    options.sort((a, b) => {
      if (a.baseChanges !== b.baseChanges) return a.baseChanges - b.baseChanges
      if (a.motifOffset !== b.motifOffset) return a.motifOffset - b.motifOffset
      return a.newHexamer.localeCompare(b.newHexamer)
    })

    lookup[originalHexamer] = options
  }
  return lookup
}, {})

function enumerateInducibleWggwCandidates(
  sequence: string,
): InducibleWggwCandidate[] {
  const upper = sequence.toUpperCase().replace(/U/g, 'T')
  const codons = toCodons(upper)
  if (codons.length < 2) return []

  const candidates: InducibleWggwCandidate[] = []

  for (let codonIndex = 0; codonIndex < codons.length - 1; codonIndex++) {
    const codon1 = codons[codonIndex]
    const codon2 = codons[codonIndex + 1]
    const originalHexamer = `${codon1}${codon2}`
    const options = WGGW_RECODING_LOOKUP[originalHexamer]
    if (!options || options.length === 0) continue

    const grouped = new Map<string, WggwRecodingOption[]>()
    for (const option of options) {
      const key = `${option.motifOffset}:${option.motif}`
      const existing = grouped.get(key)
      if (existing) existing.push(option)
      else grouped.set(key, [option])
    }

    for (const [key, rewriteOptions] of grouped) {
      const [motifOffsetString] = key.split(':')
      const motifOffset = Number(motifOffsetString)
      const primary = rewriteOptions[0]
      const hexamerStart = codonIndex * 3 + 1
      const motifStart = hexamerStart + motifOffset
      candidates.push({
        position: hexamerStart + primary.splitOffset,
        motifStart,
        motif: primary.motif,
        hexamerStart,
        originalHexamer,
        newHexamer: primary.newHexamer,
        originalCodons: [codon1, codon2],
        newCodons: primary.newCodons,
        alreadyPresent: primary.baseChanges === 0,
        baseChanges: primary.baseChanges,
        rewriteOptions,
      })
    }
  }

  return candidates.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    if (a.baseChanges !== b.baseChanges) return a.baseChanges - b.baseChanges
    return a.newHexamer.localeCompare(b.newHexamer)
  })
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
function localGcAt(seq: string, position: number, window = 40): number {
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

interface WggwCandidate {
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
      const cut = m.position + 2 // midpoint of the 4bp motif: WG|GW
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

export interface RankedInducibleWggwCandidate extends InducibleWggwCandidate {
  /** |position − seqLength/2|: distance from a 50/50 split, in bp. */
  distanceFromCenter: number
  /** 5' fragment length if the split is applied here. */
  fivePrimeLength: number
  /** 3' fragment length if the split is applied here. */
  threePrimeLength: number
}

export function rankInducibleWggwByBalance(
  sequence: string,
): RankedInducibleWggwCandidate[] {
  const len = sequence.length
  if (len < 4) return []
  const center = len / 2
  return enumerateInducibleWggwCandidates(sequence)
    .map(
      (candidate): RankedInducibleWggwCandidate => ({
        ...candidate,
        distanceFromCenter: Math.abs(candidate.position - center),
        fivePrimeLength: candidate.position,
        threePrimeLength: len - candidate.position,
      }),
    )
    .sort((a, b) => {
      if (a.distanceFromCenter !== b.distanceFromCenter) {
        return a.distanceFromCenter - b.distanceFromCenter
      }
      if (a.baseChanges !== b.baseChanges) return a.baseChanges - b.baseChanges
      return a.position - b.position
    })
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

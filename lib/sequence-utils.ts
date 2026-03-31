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

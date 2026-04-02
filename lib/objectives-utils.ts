/** Utilities for parsing DNAChisel objectives text summaries. */

// Splice-site donor patterns used in algorithm.py
const DONOR_PATTERNS = new Set(['GT[AG]A', 'AAGTA', '[CTA]AG[GA]', 'CAG[GC]'])

/** Count violation positions from a single AvoidPattern line. */
function countViolations(line: string): number {
  const posMatch = line.match(/positions \[([^\]]*)\]/)
  if (!posMatch) return 0
  return posMatch[1].split(',').filter((s) => s.trim()).length
}

/** Extract all AvoidPattern lines (excluding CG) and classify as donor or acceptor. */
function parseSpliceCounts(text: string): { donors: number; acceptors: number } {
  let donors = 0
  let acceptors = 0
  for (const line of text.split('\n')) {
    const patternMatch = line.match(/AvoidPattern\(.*?pattern:([^)]+)\)/)
    if (!patternMatch) continue
    const pattern = patternMatch[1]
    if (pattern === 'CG') continue
    const violations = countViolations(line)
    if (DONOR_PATTERNS.has(pattern)) {
      donors += violations
    } else {
      acceptors += violations
    }
  }
  return { donors, acceptors }
}

export function countSpliceDonors(text: string): number {
  return parseSpliceCounts(text).donors
}

export function countSpliceAcceptors(text: string): number {
  return parseSpliceCounts(text).acceptors
}

export function parseCAI(text: string): number | null {
  const match = text.match(/MaximizeCAI.*scored\s*([-\d.E+]+)/)
  return match ? parseFloat(match[1]) : null
}

export function parseKmerScore(text: string): number | null {
  const match = text.match(/UniquifyAllKmers.*scored\s*([-\d.E+]+)/)
  return match ? parseFloat(match[1]) : null
}

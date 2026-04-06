import { describe, expect, it } from 'vitest'

import { AAV_PACKAGING_LIMIT } from '@/lib/bio/aav'

import { pickDefaultSplitPoint } from './default-split-point'

describe('pickDefaultSplitPoint', () => {
  it('returns 1 for very short sequences', () => {
    expect(pickDefaultSplitPoint('A')).toBe(1)
    expect(pickDefaultSplitPoint('')).toBe(1)
  })

  it('returns midpoint for sequences under AAV limit', () => {
    const seq = 'A'.repeat(1000)
    expect(pickDefaultSplitPoint(seq)).toBe(500)
  })

  it('returns midpoint for sequences at AAV limit', () => {
    const seq = 'A'.repeat(AAV_PACKAGING_LIMIT)
    expect(pickDefaultSplitPoint(seq)).toBe(Math.floor(AAV_PACKAGING_LIMIT / 2))
  })

  it('returns midpoint for long sequences without WGGW motifs', () => {
    // All A's — no WGGW motifs possible
    const seq = 'A'.repeat(AAV_PACKAGING_LIMIT + 100)
    expect(pickDefaultSplitPoint(seq)).toBe(
      Math.floor((AAV_PACKAGING_LIMIT + 100) / 2),
    )
  })

  it('returns WGGW-based position for long sequences with motifs', () => {
    // Place a TGGA motif well off-center so the WGGW pick differs from midpoint
    const totalLen = AAV_PACKAGING_LIMIT + 200
    const motifPos = 100 // near the start, far from center
    const seq =
      'A'.repeat(motifPos) + 'TGGA' + 'A'.repeat(totalLen - motifPos - 4)
    const midpoint = Math.floor(totalLen / 2)
    const result = pickDefaultSplitPoint(seq)
    // With only one WGGW motif near position 100, the function picks it
    // The cut position is motifPos + 1 (1-based) + 1 (midpoint of 4bp motif)
    expect(result).not.toBe(midpoint)
  })
})

import { describe, expect, it } from 'vitest'

import { AAV_SINGLE_CDS_MAX } from '@/lib/bio/aav'

import { pickDefaultSplitPoint } from './default-split-point'

describe('pickDefaultSplitPoint', () => {
  it('returns 1 for very short sequences', () => {
    expect(pickDefaultSplitPoint('A')).toBe(1)
    expect(pickDefaultSplitPoint('')).toBe(1)
  })

  it('returns midpoint for sequences below the single-AAV CDS cutoff', () => {
    const seq = 'A'.repeat(1000)
    expect(pickDefaultSplitPoint(seq)).toBe(500)
  })

  it('returns midpoint for long sequences without WGGW motifs', () => {
    const seq = 'A'.repeat(AAV_SINGLE_CDS_MAX + 100)
    expect(pickDefaultSplitPoint(seq)).toBe(
      Math.floor((AAV_SINGLE_CDS_MAX + 100) / 2),
    )
  })

  it('returns WGGW-based position for long sequences with motifs', () => {
    const totalLen = AAV_SINGLE_CDS_MAX + 200
    const motifPos = 100
    const seq =
      'A'.repeat(motifPos) + 'TGGA' + 'A'.repeat(totalLen - motifPos - 4)
    const midpoint = Math.floor(totalLen / 2)
    const result = pickDefaultSplitPoint(seq)
    expect(result).not.toBe(midpoint)
  })
})

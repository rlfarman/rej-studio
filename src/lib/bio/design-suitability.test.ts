import { describe, expect, it } from 'vite-plus/test'

import { AAV_CDS_CAPACITY_BP } from './aav'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from './design-suitability'

// The tiers are derived from the packaging arithmetic, so the assertions are
// written against one vector's CDS capacity rather than today's numbers: move
// AAV_OVERHEAD_BP and these follow.
describe('assessDesignSuitability', () => {
  it('returns single-aav for a CDS that fills one vector exactly', () => {
    expect(assessDesignSuitability('A'.repeat(AAV_CDS_CAPACITY_BP))).toBe(
      'single-aav',
    )
  })

  it('returns dual-aav one base over one vector, and at two vectors', () => {
    expect(assessDesignSuitability('A'.repeat(AAV_CDS_CAPACITY_BP + 1))).toBe(
      'dual-aav',
    )
    expect(assessDesignSuitability('A'.repeat(AAV_CDS_CAPACITY_BP * 2))).toBe(
      'dual-aav',
    )
  })

  it('returns triple-aav one base over two vectors', () => {
    expect(
      assessDesignSuitability('A'.repeat(AAV_CDS_CAPACITY_BP * 2 + 1)),
    ).toBe('triple-aav')
  })

  it('returns single-aav for empty sequence', () => {
    expect(assessDesignSuitability('')).toBe('single-aav')
  })
})

describe('getSuitabilityConfig', () => {
  it('returns correct label for single-aav', () => {
    expect(getSuitabilityConfig('single-aav').label).toBe('Single AAV')
  })

  it('returns correct label for dual-aav', () => {
    expect(getSuitabilityConfig('dual-aav').label).toBe('Dual AAV')
  })

  it('returns correct label for triple-aav', () => {
    expect(getSuitabilityConfig('triple-aav').label).toBe('Triple AAV')
  })
})

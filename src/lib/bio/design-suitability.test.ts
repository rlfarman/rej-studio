import { describe, expect, it } from 'vitest'

import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from './design-suitability'

describe('assessDesignSuitability', () => {
  it('returns single-aav for < 4000 bp', () => {
    expect(assessDesignSuitability('A'.repeat(3999))).toBe('single-aav')
  })

  it('returns dual-aav for 4000–7999 bp', () => {
    expect(assessDesignSuitability('A'.repeat(4000))).toBe('dual-aav')
    expect(assessDesignSuitability('A'.repeat(7999))).toBe('dual-aav')
  })

  it('returns triple-aav for >= 8000 bp', () => {
    expect(assessDesignSuitability('A'.repeat(8000))).toBe('triple-aav')
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

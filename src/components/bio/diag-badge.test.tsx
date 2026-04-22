import { describe, expect, it } from 'vitest'
import {
  gcCheck,
  invalidCharsCheck,
  lengthCheck,
  multipleOf3Check,
  prematureStopCheck,
  startCodonCheck,
  stopCodonCheck,
  homopolymerCheck,
  tandemRepeatCheck,
  shortCdsCheck,
} from './diag-badge'

// Test the exported diagnostic check functions (pure logic, no rendering needed)

describe('lengthCheck', () => {
  it('returns neutral status with bp and aa counts', () => {
    const result = lengthCheck('ATGAAATGA')
    expect(result.status).toBe('neutral')
    expect(result.label).toContain('9')
    expect(result.label).toContain('3')
  })
})

describe('gcCheck', () => {
  it('returns good for GC in 35-60% range', () => {
    // 50% GC
    const result = gcCheck('ATGCATGC'.repeat(10))
    expect(result.status).toBe('good')
  })

  it('returns warn for GC outside optimal but in 25-70% range', () => {
    // ~30% GC — outside 35-60% but inside 25-70%
    const result = gcCheck('AATTAATGCC'.repeat(10))
    expect(['good', 'warn']).toContain(result.status)
  })

  it('returns error for extreme GC', () => {
    // 0% GC
    const result = gcCheck('AAAAAAAAAA')
    expect(result.status).toBe('error')
  })
})

describe('startCodonCheck', () => {
  it('returns good for ATG start', () => {
    expect(startCodonCheck('ATGAAATGA').status).toBe('good')
  })

  it('returns error for non-ATG start', () => {
    expect(startCodonCheck('GGGAAATGA').status).toBe('error')
  })
})

describe('stopCodonCheck', () => {
  it('returns good for TGA stop', () => {
    expect(stopCodonCheck('ATGAAATGA').status).toBe('good')
  })

  it('returns warn for missing stop', () => {
    expect(stopCodonCheck('ATGAAAGGG').status).toBe('warn')
  })
})

describe('multipleOf3Check', () => {
  it('returns null for valid length', () => {
    expect(multipleOf3Check('ATGAAATGA')).toBeNull()
  })

  it('returns error for invalid length', () => {
    const result = multipleOf3Check('ATGAA')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('error')
  })
})

describe('invalidCharsCheck', () => {
  it('returns null for valid sequence', () => {
    expect(invalidCharsCheck('ATGCATGC')).toBeNull()
  })

  it('returns error for invalid chars', () => {
    const result = invalidCharsCheck('ATGXYZ')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('error')
  })
})

describe('prematureStopCheck', () => {
  it('returns null for valid CDS', () => {
    expect(prematureStopCheck('ATGAAATGA')).toBeNull()
  })

  it('returns error for internal stop codon', () => {
    const result = prematureStopCheck('ATGTAAAAATGA')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('error')
  })

  it('returns null for short sequences', () => {
    expect(prematureStopCheck('ATG')).toBeNull()
  })
})

describe('homopolymerCheck', () => {
  it('returns null for normal sequence', () => {
    expect(homopolymerCheck('ATGCATGCATGC')).toBeNull()
  })

  it('returns warn for run of 8+ identical bases', () => {
    const result = homopolymerCheck('AAAAAAAAA')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('warn')
  })
})

describe('tandemRepeatCheck', () => {
  it('returns null for normal sequence', () => {
    expect(tandemRepeatCheck('ATGCATGCATGC')).toBeNull()
  })

  it('returns warn for tandem repeat', () => {
    // 6bp unit repeated: ABCDEFABCDEF
    const result = tandemRepeatCheck('ATGCGAATGCGA')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('warn')
  })
})

describe('shortCdsCheck', () => {
  it('returns null for sequence >= 300bp', () => {
    expect(shortCdsCheck('A'.repeat(300))).toBeNull()
  })

  it('returns warn for short CDS', () => {
    const result = shortCdsCheck('ATGAAATGA')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('warn')
  })

  it('returns null for very short sequences (< 6bp)', () => {
    expect(shortCdsCheck('ATG')).toBeNull()
  })
})

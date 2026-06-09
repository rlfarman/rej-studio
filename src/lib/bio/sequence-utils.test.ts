import { describe, expect, it } from 'vitest'

import {
  assessFragmentBalance,
  changeDensity,
  computeGcPercent,
  countCpG,
  detectSequenceType,
  findInvalidChars,
  findWggwMotifs,
  getStopCodonStatus,
  hasStartCodon,
  rankInducibleWggwByBalance,
  rankWggwByBalance,
  segmentSequence,
  slidingGcContent,
} from './sequence-utils'

describe('detectSequenceType', () => {
  it('classifies plain DNA as dna', () => {
    expect(detectSequenceType('ATGCGTACGTACGT')).toBe('dna')
  })
  it('classifies RNA as dna (U is ambiguous)', () => {
    expect(detectSequenceType('AUGCGUACGU')).toBe('dna')
  })
  it('classifies protein with protein-only letters as protein', () => {
    expect(detectSequenceType('MASFKPGQQWVEIYHLNKD')).toBe('protein')
  })
  it('classifies short ACGT-only peptide as dna (ambiguous, default)', () => {
    expect(detectSequenceType('ACGT')).toBe('dna')
  })
  it('strips FASTA headers before classifying', () => {
    expect(detectSequenceType('>sp|P12345|PROT\nMASFKPGQQWVE')).toBe('protein')
  })
  it('returns dna for empty input', () => {
    expect(detectSequenceType('')).toBe('dna')
  })
  it('ignores whitespace and newlines', () => {
    expect(detectSequenceType('MASF\nKPGQ\tQWVE')).toBe('protein')
  })
})

// ---------------------------------------------------------------------------
// computeGcPercent
// ---------------------------------------------------------------------------
describe('computeGcPercent', () => {
  it('returns 0 for empty string', () => {
    expect(computeGcPercent('')).toBe(0)
  })
  it('returns 100 for all GC', () => {
    expect(computeGcPercent('GCGCGC')).toBe(100)
  })
  it('returns 0 for all AT', () => {
    expect(computeGcPercent('ATATAT')).toBe(0)
  })
  it('returns 50 for balanced', () => {
    expect(computeGcPercent('ATGC')).toBe(50)
  })
  it('handles single base', () => {
    expect(computeGcPercent('G')).toBe(100)
    expect(computeGcPercent('A')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// findWggwMotifs
// ---------------------------------------------------------------------------
describe('findWggwMotifs', () => {
  it('returns empty for sequences shorter than 4', () => {
    expect(findWggwMotifs('TGG')).toEqual([])
  })
  it('finds single TGGA motif', () => {
    expect(findWggwMotifs('AATGGACC')).toEqual([{ position: 3, motif: 'TGGA' }])
  })
  it('finds multiple non-overlapping motifs', () => {
    const result = findWggwMotifs('TGGATGGAAAGGA')
    const positions = result.map((m) => m.position)
    expect(positions).toContain(1)
    expect(positions).toContain(5)
    expect(positions).toContain(10)
  })
  it('catches overlapping motifs', () => {
    // TGGT contains two overlapping: TGGT at pos 1 (but TGGT is [AT]GG[AT], T=W, T=W, so TGGT is valid)
    const result = findWggwMotifs('ATGGTA')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].motif).toBe('TGGT')
  })
  it('handles RNA input (U→T conversion)', () => {
    const result = findWggwMotifs('UGGAAAA')
    expect(result).toEqual([{ position: 1, motif: 'TGGA' }])
  })
  it('is case-insensitive', () => {
    expect(findWggwMotifs('tggaaaa')).toEqual([{ position: 1, motif: 'TGGA' }])
  })
  it('returns 1-based positions', () => {
    const result = findWggwMotifs('AGGA')
    expect(result).toEqual([{ position: 1, motif: 'AGGA' }])
  })
})

// ---------------------------------------------------------------------------
// slidingGcContent
// ---------------------------------------------------------------------------
describe('slidingGcContent', () => {
  it('returns empty for empty sequence', () => {
    expect(slidingGcContent('')).toEqual([])
  })
  it('returns points for a sequence', () => {
    const points = slidingGcContent('ATGCATGCATGC', 4, 4)
    expect(points.length).toBeGreaterThan(0)
    // Every point should have gc between 0 and 100
    for (const p of points) {
      expect(p.gc).toBeGreaterThanOrEqual(0)
      expect(p.gc).toBeLessThanOrEqual(100)
    }
  })
  it('always ends with a point at the last position', () => {
    const seq = 'ATGCATGCATGCATGC'
    const points = slidingGcContent(seq, 4, 4)
    expect(points[points.length - 1].position).toBe(seq.length - 1)
  })
  it('returns consistent GC% for a uniform sequence', () => {
    // All G's — 100% GC everywhere
    const points = slidingGcContent('GGGGGGGG', 4, 4)
    expect(points[0].gc).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// changeDensity
// ---------------------------------------------------------------------------
describe('changeDensity', () => {
  it('returns empty for empty sequences', () => {
    expect(changeDensity('', '', 5)).toEqual([])
  })
  it('returns 0 changes for identical sequences', () => {
    const bins = changeDensity('ATGCATGC', 'ATGCATGC', 2)
    expect(bins.every((b) => b.changes === 0)).toBe(true)
  })
  it('counts all changes for fully different sequences', () => {
    const bins = changeDensity('AAAA', 'TTTT', 1)
    const totalChanges = bins.reduce((sum, b) => sum + b.changes, 0)
    expect(totalChanges).toBe(4)
  })
  it('bins are non-overlapping and cover the full length', () => {
    const bins = changeDensity('ATGCATGC', 'TTTTTTTT', 3)
    // Bins should cover start=0 to end=8
    expect(bins[0].start).toBe(0)
    expect(bins[bins.length - 1].end).toBe(8)
  })
  it('returns empty for binCount <= 0', () => {
    expect(changeDensity('ATGC', 'TTTT', 0)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// hasStartCodon
// ---------------------------------------------------------------------------
describe('hasStartCodon', () => {
  it('returns true for ATG at start', () => {
    expect(hasStartCodon('ATGAAATGA')).toBe(true)
  })
  it('returns true for lowercase', () => {
    expect(hasStartCodon('atgaaatga')).toBe(true)
  })
  it('returns false for non-ATG start', () => {
    expect(hasStartCodon('GGGAAATGA')).toBe(false)
  })
  it('returns false for too short', () => {
    expect(hasStartCodon('AT')).toBe(false)
  })
  it('returns false for empty', () => {
    expect(hasStartCodon('')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getStopCodonStatus
// ---------------------------------------------------------------------------
describe('getStopCodonStatus', () => {
  it('returns present for TAA', () => {
    expect(getStopCodonStatus('ATGTAA')).toBe('present')
  })
  it('returns present for TAG', () => {
    expect(getStopCodonStatus('ATGTAG')).toBe('present')
  })
  it('returns present for TGA', () => {
    expect(getStopCodonStatus('ATGTGA')).toBe('present')
  })
  it('returns absent for non-stop ending', () => {
    expect(getStopCodonStatus('ATGGGG')).toBe('absent')
  })
  it('returns none for sequences shorter than 3', () => {
    expect(getStopCodonStatus('AT')).toBe('none')
  })
  it('is case-insensitive', () => {
    expect(getStopCodonStatus('atgtaa')).toBe('present')
  })
})

// ---------------------------------------------------------------------------
// countCpG
// ---------------------------------------------------------------------------
describe('countCpG', () => {
  it('returns 0 for no CpG', () => {
    expect(countCpG('AAATTT')).toBe(0)
  })
  it('counts single CpG', () => {
    expect(countCpG('ACGTT')).toBe(1)
  })
  it('counts adjacent CpGs: CGCG = 2', () => {
    expect(countCpG('CGCG')).toBe(2)
  })
  it('handles empty', () => {
    expect(countCpG('')).toBe(0)
  })
  it('is case-insensitive', () => {
    expect(countCpG('acgtt')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// findInvalidChars
// ---------------------------------------------------------------------------
describe('findInvalidChars', () => {
  it('returns empty for valid sequence', () => {
    expect(findInvalidChars('ATGCatgcUu')).toEqual([])
  })
  it('finds invalid characters', () => {
    const invalid = findInvalidChars('ATGXNY')
    expect(invalid).toContain('X')
    expect(invalid).toContain('N')
    expect(invalid).toContain('Y')
  })
  it('deduplicates', () => {
    const invalid = findInvalidChars('XXXX')
    expect(invalid).toEqual(['X'])
  })
  it('finds spaces and numbers', () => {
    const invalid = findInvalidChars('ATG 123')
    expect(invalid).toContain(' ')
    expect(invalid).toContain('1')
  })
})

// ---------------------------------------------------------------------------
// rankWggwByBalance
// ---------------------------------------------------------------------------
describe('rankWggwByBalance', () => {
  it('returns empty for short sequences', () => {
    expect(rankWggwByBalance('ATG')).toEqual([])
  })
  it('sorts by distance from center', () => {
    // Build a sequence with WGGW motifs at different positions
    const seq =
      'A'.repeat(20) + 'TGGA' + 'A'.repeat(20) + 'AGGT' + 'A'.repeat(20)
    const ranked = rankWggwByBalance(seq)
    expect(ranked.length).toBeGreaterThan(0)
    // Should be sorted ascending by distanceFromCenter
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].distanceFromCenter).toBeGreaterThanOrEqual(
        ranked[i - 1].distanceFromCenter,
      )
    }
  })
  it('includes fragment lengths', () => {
    const seq = 'AATGGAAA'
    const ranked = rankWggwByBalance(seq)
    if (ranked.length > 0) {
      const first = ranked[0]
      expect(first.position).toBe(4)
      expect(first.fivePrimeLength).toBe(4)
      expect(first.threePrimeLength).toBe(4)
      expect(first.fivePrimeLength + first.threePrimeLength).toBe(seq.length)
    }
  })
})

describe('rankInducibleWggwByBalance', () => {
  it('reports the WG|GW cut as the number of bases on the 5′ side', () => {
    const ranked = rankInducibleWggwByBalance('AATGGAAA')
    const existing = ranked.find((candidate) => candidate.alreadyPresent)
    expect(existing).toBeDefined()
    expect(existing?.motifStart).toBe(3)
    expect(existing?.position).toBe(4)
    expect(existing?.fivePrimeLength).toBe(4)
    expect(existing?.threePrimeLength).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// assessFragmentBalance
// ---------------------------------------------------------------------------
describe('assessFragmentBalance', () => {
  it('returns balanced for 50/50 split', () => {
    expect(assessFragmentBalance(500, 1000)).toBe('balanced')
  })
  it('returns balanced for 30/70 split', () => {
    expect(assessFragmentBalance(300, 1000)).toBe('balanced')
  })
  it('returns moderate for 25/75 split', () => {
    expect(assessFragmentBalance(250, 1000)).toBe('moderate')
  })
  it('returns imbalanced for 10/90 split', () => {
    expect(assessFragmentBalance(100, 1000)).toBe('imbalanced')
  })
  it('returns balanced for zero-length edge case', () => {
    expect(assessFragmentBalance(0, 0)).toBe('balanced')
  })
})

// ---------------------------------------------------------------------------
// segmentSequence
// ---------------------------------------------------------------------------
describe('segmentSequence', () => {
  it('returns empty for empty string', () => {
    expect(segmentSequence('')).toEqual([])
  })

  it('segments a valid CDS correctly', () => {
    // ATG (start) + AAA (normal) + TGA (stop)
    const segments = segmentSequence('ATGAAATGA')
    expect(segments).toEqual([
      { text: 'ATG', type: 'start-codon' },
      { text: 'AAA', type: 'normal' },
      { text: 'TGA', type: 'stop-codon' },
    ])
  })

  it('marks missing start codon', () => {
    const segments = segmentSequence('GGGAAATGA')
    expect(segments[0]).toEqual({ text: 'GGG', type: 'missing-start' })
  })

  it('marks missing stop codon', () => {
    const segments = segmentSequence('ATGAAAGGG')
    const last = segments[segments.length - 1]
    expect(last.type).toBe('missing-stop')
  })

  it('marks internal stop codons', () => {
    // ATG + TAA (internal stop) + AAA + TGA (stop)
    const segments = segmentSequence('ATGTAAAAATGA')
    const types = segments.map((s) => s.type)
    expect(types).toContain('internal-stop')
  })

  it('marks invalid characters with highest priority', () => {
    const segments = segmentSequence('XATGAAATGA')
    // First char is invalid, overrides everything
    expect(segments[0]).toEqual({ text: 'X', type: 'invalid-char' })
  })

  it('marks remainder when not multiple of 3', () => {
    const segments = segmentSequence('ATGAA')
    const last = segments[segments.length - 1]
    expect(last.type).toBe('remainder')
  })

  it('handles RNA stop codons (UAA, UAG, UGA)', () => {
    const segments = segmentSequence('AUGAAAUAA')
    expect(segments[0].type).toBe('start-codon')
    expect(segments[segments.length - 1].type).toBe('stop-codon')
  })
})

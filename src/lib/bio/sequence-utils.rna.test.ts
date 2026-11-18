import { describe, expect, it } from 'vite-plus/test'

import { getStopCodonStatus, hasStartCodon } from './sequence-utils'

/**
 * mRNA is an accepted input: the schema takes U, and both the placeholder and
 * the "valid nucleotides" message advertise it. A sequence that validates
 * cleanly must not then be reported as having neither a start nor a stop
 * codon.
 */
const RNA_CDS = 'AUGAAAUAA'

describe('codon checks on RNA input', () => {
  it('reads AUG as a start codon', () => {
    expect(hasStartCodon(RNA_CDS)).toBe(true)
    expect(hasStartCodon('augaaauaa')).toBe(true)
  })

  it('reads UAA, UAG and UGA as stop codons', () => {
    expect(getStopCodonStatus('AUGAAAUAA')).toBe('present')
    expect(getStopCodonStatus('AUGAAAUAG')).toBe('present')
    expect(getStopCodonStatus('AUGAAAUGA')).toBe('present')
    expect(getStopCodonStatus('AUGAAAGGG')).toBe('absent')
  })

  it('still rejects a start that is neither ATG nor AUG', () => {
    expect(hasStartCodon('GGGAAAUAA')).toBe(false)
  })
})

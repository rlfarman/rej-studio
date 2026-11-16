import { describe, expect, it } from 'vitest'
import { buildIsoformsFasta, isoformsFastaFilename } from './isoform-fasta'

describe('buildIsoformsFasta', () => {
  it('writes one labeled record per isoform', () => {
    const fasta = buildIsoformsFasta('TP53', [
      { id: 'ENST1', codingSequence: 'ATGAAATGA', codingSequenceLength: 9 },
      { id: 'ENST2', codingSequence: 'ATGTGA', codingSequenceLength: 6 },
    ])
    expect(fasta).toBe(
      '>ENST1 TP53 CDS=9bp\nATGAAATGA\n>ENST2 TP53 CDS=6bp\nATGTGA\n',
    )
  })

  it('wraps long sequences at 80 columns', () => {
    const seq = 'A'.repeat(100)
    const lines = buildIsoformsFasta('X', [
      { id: 'E', codingSequence: seq, codingSequenceLength: 100 },
    ]).split('\n')
    expect(lines[1]).toHaveLength(80)
    expect(lines[2]).toHaveLength(20)
  })

  it('names the file after the gene', () => {
    expect(isoformsFastaFilename('BRCA1')).toBe('BRCA1_isoforms_CDS.fasta')
  })
})

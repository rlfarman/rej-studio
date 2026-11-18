import { describe, expect, it } from 'vite-plus/test'
import {
  buildIsoformFasta,
  buildIsoformsFasta,
  isoformFastaFilename,
  isoformsFastaFilename,
} from './isoform-fasta'

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

describe('buildIsoformFasta', () => {
  // One record leaves the app alone more often than the set does: in a
  // folder of twenty transcripts, a bare `>ENST…` says nothing about which
  // gene it came from.
  it('heads a single record with its gene and its length', () => {
    expect(
      buildIsoformFasta('TP53', {
        id: 'ENST00000269305',
        codingSequence: 'ATGAAATGA',
        codingSequenceLength: 9,
      }),
    ).toBe('>ENST00000269305 TP53 CDS=9bp\nATGAAATGA')
  })

  it('writes the same header the whole-gene file writes', () => {
    const isoform = {
      id: 'ENST1',
      codingSequence: 'ATGTGA',
      codingSequenceLength: 6,
    }
    expect(buildIsoformsFasta('TP53', [isoform]).trim()).toBe(
      buildIsoformFasta('TP53', isoform),
    )
  })

  it('names the file after the gene as well as the transcript', () => {
    expect(isoformFastaFilename('TP53', 'ENST00000269305')).toBe(
      'TP53_ENST00000269305_CDS.fasta',
    )
  })
})

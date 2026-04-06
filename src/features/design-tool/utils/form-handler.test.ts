import { describe, expect, it } from 'vitest'
import type { FormValues } from '../types/form-schema'
import { buildJobParams, formatOptionsForReport } from './form-handler'

const BASE_VALUES: FormValues = {
  codingSequence: 'ATGAAATGA',
  name: 'Test Gene',
  species: 'human',
  codonOptimizeWeight: 50,
  removeCrypticSpliceSites: true,
  removeCrypticSpliceSitesWeight: 75,
  minimizeCpgs: true,
  minimizeCpgsWeight: 60,
  reduceKmerComplexity: false,
  reduceKmerComplexityWeight: 40,
  enforceGcContent: true,
  '5PrimeStimulatoryIntron': true,
  '3PrimeStimulatoryIntron': false,
  spliceJunctionPosition: 3,
}

describe('buildJobParams', () => {
  it('maps FormValues to JobParams structure', () => {
    const params = buildJobParams(BASE_VALUES)
    expect(params.CDS).toBe('ATGAAATGA')
    expect(params.name).toBe('Test Gene')
    expect(params.options).toBeDefined()
  })

  it('maps species=human to codon_optimize=human', () => {
    const params = buildJobParams(BASE_VALUES)
    expect(params.options.codon_optimize).toBe('human')
  })

  it('maps species=none to codon_optimize=null', () => {
    const params = buildJobParams({ ...BASE_VALUES, species: 'none' })
    expect(params.options.codon_optimize).toBeNull()
  })

  it('maps boolean flags correctly', () => {
    const params = buildJobParams(BASE_VALUES)
    expect(params.options.remove_cryptic_ss).toBe(true)
    expect(params.options.minimize_CpGs).toBe(true)
    expect(params.options.reduce_kmer_complexity).toBe(false)
    expect(params.options.enforce_gc).toBe(true)
    expect(params.options.stim_5).toBe(true)
    expect(params.options.stim_3).toBe(false)
  })

  it('maps weights correctly', () => {
    const params = buildJobParams(BASE_VALUES)
    expect(params.options.codon_optimize_weight).toBe(50)
    expect(params.options.remove_cryptic_ss_weight).toBe(75)
    expect(params.options.minimize_CpGs_weight).toBe(60)
  })

  it('maps splice junction position to split_point', () => {
    const params = buildJobParams(BASE_VALUES)
    expect(params.options.split_point).toBe(3)
  })

  it('always sets ensure_wggw=true and wggw_threshold=300', () => {
    const params = buildJobParams(BASE_VALUES)
    expect(params.options.ensure_wggw).toBe(true)
    expect(params.options.wggw_threshold).toBe(300)
  })
})

describe('formatOptionsForReport', () => {
  it('returns valid JSON string', () => {
    const report = formatOptionsForReport(BASE_VALUES)
    expect(() => JSON.parse(report)).not.toThrow()
  })

  it('includes key option values', () => {
    const report = formatOptionsForReport(BASE_VALUES)
    const parsed = JSON.parse(report)
    expect(parsed.codon_optimize).toBe('human')
    expect(parsed.enforce_gc).toBe(true)
  })
})

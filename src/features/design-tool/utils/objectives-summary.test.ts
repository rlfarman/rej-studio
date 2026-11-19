import { describe, expect, it } from 'vite-plus/test'

import { designToolCopy } from '../copy'
import { summarizeObjectives, type ObjectiveValues } from './objectives-summary'

const items = designToolCopy.optimizationOptions.summary.items

/** Mirrors the form's defaultValues in gene-splitter-form.tsx. */
const DEFAULTS: ObjectiveValues = {
  species: 'none',
  removeCrypticSpliceSites: true,
  minimizeCpgs: true,
  reduceKmerComplexity: true,
  enforceGcContent: true,
  '5PrimeStimulatoryIntron': true,
  '3PrimeStimulatoryIntron': true,
  codonOptimizeWeight: 1,
  removeCrypticSpliceSitesWeight: 1,
  minimizeCpgsWeight: 1,
  reduceKmerComplexityWeight: 1,
}

describe('summarizeObjectives', () => {
  it('reports the untouched form as the recommended set', () => {
    const summary = summarizeObjectives(DEFAULTS)
    expect(summary.isDefault).toBe(true)
    expect(summary.items).toEqual([
      // A blank form has no species, so the headline objective is off. The
      // set says so rather than reading as a complete recommendation.
      items.codonOff,
      items.spliceSites,
      items.cpg,
      items.kmer,
      items.gc,
      items.intronsBoth,
    ])
    // Introns are placement, not scored objectives, and "codon usage off" is
    // the absence of one — neither is counted.
    expect(summary.count).toBe(4)
    expect(summary.intronCount).toBe(2)
  })

  it('names the species when codon optimization is on', () => {
    expect(
      summarizeObjectives({ ...DEFAULTS, species: 'human' }).items,
    ).toContain(items.codonHuman)
    expect(
      summarizeObjectives({ ...DEFAULTS, species: 'mouse' }).items,
    ).toContain(items.codonMouse)
    // Species alone doesn't make the rest custom.
    expect(
      summarizeObjectives({ ...DEFAULTS, species: 'human' }).isDefault,
    ).toBe(true)
    expect(summarizeObjectives({ ...DEFAULTS, species: 'human' }).count).toBe(5)
    // Naming a species replaces the "off" note rather than adding to it.
    expect(
      summarizeObjectives({ ...DEFAULTS, species: 'human' }).items,
    ).not.toContain(items.codonOff)
  })

  it('marks the set custom when a toggle is off', () => {
    const summary = summarizeObjectives({ ...DEFAULTS, minimizeCpgs: false })
    expect(summary.isDefault).toBe(false)
    expect(summary.items).not.toContain(items.cpg)
    expect(summary.count).toBe(3)
  })

  it('marks the set custom when a weight is changed', () => {
    expect(
      summarizeObjectives({ ...DEFAULTS, minimizeCpgsWeight: 5 }).isDefault,
    ).toBe(false)
    // A changed weight doesn't remove the objective from the list.
    expect(
      summarizeObjectives({ ...DEFAULTS, minimizeCpgsWeight: 5 }).items,
    ).toContain(items.cpg)
  })

  it('names a single stimulatory intron when only one is on', () => {
    expect(
      summarizeObjectives({ ...DEFAULTS, '3PrimeStimulatoryIntron': false })
        .items,
    ).toContain(items.intron5)
    expect(
      summarizeObjectives({ ...DEFAULTS, '5PrimeStimulatoryIntron': false })
        .items,
    ).toContain(items.intron3)
  })

  it('names the gap when everything scored is off', () => {
    const summary = summarizeObjectives({
      ...DEFAULTS,
      removeCrypticSpliceSites: false,
      minimizeCpgs: false,
      reduceKmerComplexity: false,
      enforceGcContent: false,
      '5PrimeStimulatoryIntron': false,
      '3PrimeStimulatoryIntron': false,
    })
    // Not empty: with no species there is still something true to say.
    expect(summary.items).toEqual([items.codonOff])
    expect(summary.count).toBe(0)
    expect(summary.intronCount).toBe(0)
    expect(summary.isDefault).toBe(false)
  })

  it('counts one intron when only one is on', () => {
    expect(
      summarizeObjectives({ ...DEFAULTS, '3PrimeStimulatoryIntron': false })
        .intronCount,
    ).toBe(1)
  })
})

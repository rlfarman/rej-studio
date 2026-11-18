import { cleanup, render, screen } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import { designToolCopy } from '../copy'
import type { FormValues } from '../types/form-schema'
import { RunSummary } from './run-summary'
import { AAV_MAX_BP } from './splice-slider/constants'

/**
 * The last line read before pressing Run. It must count what will actually be
 * designed, in the unit that thing is measured in, and it must not stay quiet
 * about a fragment that cannot package.
 */

const defaults: Partial<FormValues> = {
  sequenceType: 'dna',
  codingSequence: '',
  proteinSequence: '',
  species: 'human',
  spliceJunctionPositions: [1],
}

function mount(values: Partial<FormValues>) {
  function Harness() {
    const form = useForm<FormValues>({
      defaultValues: { ...defaults, ...values } as FormValues,
    })
    return (
      <FormProvider {...form}>
        <RunSummary />
      </FormProvider>
    )
  }
  render(<Harness />)
}

const cds = (bp: number) => `ATG${'GCT'.repeat(bp / 3 - 2)}TAA`

afterEach(cleanup)

describe('RunSummary', () => {
  it('counts a protein in residues while its DNA is still coming', () => {
    mount({
      sequenceType: 'protein',
      proteinSequence: 'M'.repeat(60),
      codingSequence: '',
    })
    const line = screen.getByText(/objective/).textContent ?? ''
    expect(line).toContain(`60 ${designToolCopy.units.residues}`)
    expect(line).not.toContain('60 bp')
  })

  it('counts the DNA a protein reverse-translated to, in bp', () => {
    mount({
      sequenceType: 'protein',
      proteinSequence: 'M'.repeat(60),
      codingSequence: 'ATG'.repeat(60),
    })
    expect(screen.getByText(/objective/).textContent).toContain('180 bp')
  })

  it('says a fragment is over the AAV limit', () => {
    // 10,000 bp split in the middle: two 5,000 bp fragments, neither of which
    // fits a single AAV.
    mount({ codingSequence: cds(10002), spliceJunctionPositions: [5001] })
    expect(
      screen.getByText(
        designToolCopy.form.runSummary.overAavLimit(
          (5001).toLocaleString(),
          AAV_MAX_BP.toLocaleString(),
        ),
      ),
    ).toBeTruthy()
  })

  it('stays quiet when both fragments fit an AAV', () => {
    mount({ codingSequence: cds(3000), spliceJunctionPositions: [1500] })
    expect(screen.getByText(/objective/).textContent).not.toContain('AAV')
  })
})

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { FormValues } from '../types/form-schema'
import { CodingSequenceInput } from './coding-sequence-input'

/**
 * What one keystroke costs at AAV-cargo lengths.
 *
 * This field is where a 2–5 kb cargo is edited by hand, and it accepts up to
 * 50,000 bp. Every keystroke re-segments the sequence and re-renders the
 * highlight layer, and the cost of that layer is per highlighted run, not per
 * base: a sequence typed out of frame has an in-frame stop every few codons,
 * so the worst case is thousands of runs. The budget below is the point of
 * the test — it fails if the layer goes back to mounting a component per run.
 *
 * The numbers are happy-dom's, so they are a fraction of a browser's; what
 * matters is that they stop growing with the sequence.
 */

// The hook asks the optimizer worker for DNA; this measures DNA mode, where it
// never does, and the worker module must not load the wasm in a test.
vi.mock('../api/browser-optimizer', () => ({
  reverseTranslateInBrowser: vi.fn(),
}))

/**
 * A sequence whose reading frame is off, so the highlight layer has an
 * in-frame stop to mark every few codons: the worst case for its cost, and
 * what a part-typed sequence looks like.
 */
function outOfFrameSequence(bp: number): string {
  const codons = ['GCT', 'TGC', 'TAA', 'GAA', 'TGA', 'GGT', 'TAG', 'ATT']
  const body: string[] = []
  for (let i = 0; i < Math.floor(bp / 3) - 2; i++) {
    body.push(codons[i % codons.length])
  }
  return `ATG${body.join('')}TAA`
}

function mount(initial: string) {
  function Harness() {
    const form = useForm<FormValues>({
      defaultValues: {
        sequenceType: 'dna',
        codingSequence: initial,
        proteinSequence: '',
        species: 'human',
        spliceJunctionPositions: [Math.max(1, Math.floor(initial.length / 2))],
      } as FormValues,
    })
    return (
      <FormProvider {...form}>
        <CodingSequenceInput />
      </FormProvider>
    )
  }
  render(<Harness />)
  const textarea = document.querySelector('textarea')
  const backdrop = document.querySelector('[aria-hidden="true"].absolute')
  if (!textarea || !backdrop) throw new Error('the field did not render')
  return { textarea, backdrop }
}

/** Median ms of synchronous work per keystroke typed at the end. */
function typeAtEnd(textarea: HTMLTextAreaElement, keystrokes: number): number {
  const times: number[] = []
  for (let i = 0; i < keystrokes; i++) {
    const next = `${textarea.value}A`
    const start = performance.now()
    act(() => {
      fireEvent.input(textarea, { target: { value: next } })
    })
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]
}

/**
 * Generous: the measurement was ~19 ms at 14.4 kb after this layer stopped
 * mounting a tooltip per highlighted run, and ~138 ms before. A loaded CI
 * runner may be several times slower than a laptop and still pass; a
 * regression to a component per run will not.
 */
const BUDGET_MS = 60

afterEach(cleanup)

describe('CodingSequenceInput typing cost', () => {
  for (const bp of [306, 3600, 7200, 14400]) {
    it(`stays inside the keystroke budget at ${bp} bp`, () => {
      const { textarea } = mount(outOfFrameSequence(bp))
      const median = typeAtEnd(textarea, 9)
      console.log(`[perf] ${bp} bp: ${median.toFixed(1)} ms per keystroke`)
      expect(median).toBeLessThan(BUDGET_MS)
    })
  }

  it('still highlights the whole sequence while typing', () => {
    const { textarea, backdrop } = mount(outOfFrameSequence(3600))
    typeAtEnd(textarea, 3)
    expect(backdrop.textContent).toBe(textarea.value)
    // The marks are what the highlighting is: start/stop codons, the
    // in-frame stops and the incomplete trailing codon.
    expect(backdrop.querySelectorAll('mark').length).toBeGreaterThan(1)
  })
})

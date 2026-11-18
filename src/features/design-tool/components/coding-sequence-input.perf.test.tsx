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

/**
 * The cheapest of `keystrokes` keystrokes typed at the end, in ms.
 *
 * The fastest sample, not the median: every sample is this machine's work plus
 * whatever else it was doing, and only the floor of that distribution
 * estimates the work. The median of nine samples read 24 ms here idle and 76 ms
 * with three agents and a full suite running beside it — the same code, a
 * budget that passed alone and failed in `pnpm verify`. The minimum moved from
 * 21 ms to 18 ms across those same two runs.
 */
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
  return Math.min(...times)
}

/**
 * Generous: the floor measured ~21 ms at 14.4 kb after this layer stopped
 * mounting a tooltip per highlighted run, and ~138 ms before. A loaded CI
 * runner may be a couple of times slower than a laptop and still pass; a
 * regression to a component per run, or to a full re-scan of the sequence on
 * every render, will not.
 */
const BUDGET_MS = 60

/**
 * Elements the layer draws per highlighted run: a `mark` and the `span` inside
 * it. The number is what the wall-clock budget above is really about, and it
 * does not depend on how loaded the machine is — so it is asserted at every
 * length, because the fault it guards against (a component per run) shows up
 * as this ratio growing. It is a ceiling rather than an equality: the trailing
 * incomplete codon is marked without an inner span.
 */
const ELEMENTS_PER_MARK = 2

afterEach(cleanup)

describe('CodingSequenceInput typing cost', () => {
  for (const bp of [306, 3600, 7200, 14400]) {
    it(`stays inside the keystroke budget at ${bp} bp`, () => {
      const { textarea, backdrop } = mount(outOfFrameSequence(bp))
      const floorMs = typeAtEnd(textarea, 9)
      console.log(`[perf] ${bp} bp: ${floorMs.toFixed(1)} ms per keystroke`)

      const marks = backdrop.querySelectorAll('mark').length
      expect(marks).toBeGreaterThan(1)
      expect(backdrop.querySelectorAll('*').length).toBeLessThanOrEqual(
        marks * ELEMENTS_PER_MARK,
      )
      expect(floorMs).toBeLessThan(BUDGET_MS)
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

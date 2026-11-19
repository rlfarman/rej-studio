// The finished design, as the panel presents it: what it says about the run
// has to match the run — the inputs it was submitted with, the report it
// carries, and the units the numbers are actually in.

import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'

vi.mock('@/features/design-tool/utils/build-zip', () => ({
  downloadResultsZip: vi.fn(),
}))

import type { FormValues } from '@/features/design-tool/types/form-schema'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { processResultSchema } from '@/features/design-tool/types/optimizer-contract'
import fixture from '@/features/design-tool/types/process-result.fixture.json'
import { downloadResultsZip } from '@/features/design-tool/utils/build-zip'

import { ResultsPanel } from './results-panel'

const RESULT = processResultSchema.parse(fixture) as ProcessResult

const RUN_VALUES: FormValues = {
  sequenceType: 'dna',
  codingSequence: RESULT.original_sequence,
  proteinSequence: '',
  name: RESULT.name,
  species: 'human',
  codonOptimizeWeight: 1,
  removeCrypticSpliceSites: true,
  removeCrypticSpliceSitesWeight: 1,
  minimizeCpgs: true,
  minimizeCpgsWeight: 1,
  reduceKmerComplexity: true,
  reduceKmerComplexityWeight: 1,
  enforceGcContent: true,
  '5PrimeStimulatoryIntron': false,
  '3PrimeStimulatoryIntron': false,
  selectedWggwSites: [null],
  spliceJunctionPositions: [RESULT.split_point],
}

afterEach(() => {
  cleanup()
  vi.mocked(downloadResultsZip).mockClear()
})

const panel = (
  result: ProcessResult,
  runValues: FormValues | null = RUN_VALUES,
) => render(<ResultsPanel result={result} runValues={runValues} />)

describe('the Run record row', () => {
  it('says it was not recorded when the result carries none', () => {
    const { run_record: _dropped, ...withoutRecord } = RESULT
    panel(withoutRecord as ProcessResult)

    expect(screen.getByText(/Not recorded/)).toBeTruthy()
    expect(screen.queryByText(/Repeatable/)).toBeNull()
  })
})

describe('what the panel calls the numbers', () => {
  // The fixture's MaximizeCAI entry scores -2.55. Shown as "CAI", a number
  // an order of magnitude outside 0–1 reads as a broken pipeline.
  it('reports a CAI inside 0–1, not the optimizer’s objective score', () => {
    const { container } = panel(RESULT)

    const cai = screen
      .getByText('CAI')
      .parentElement!.textContent!.replace('CAI', '')
    expect(cai).not.toContain('-2.5')
    for (const value of cai.match(/\d+\.\d+/g) ?? []) {
      expect(Number(value)).toBeGreaterThan(0)
      expect(Number(value)).toBeLessThanOrEqual(1)
    }
    expect(container.textContent).not.toContain('-2.55')
  })

  it('names the objective score for what it is when no species was chosen', () => {
    panel(RESULT, { ...RUN_VALUES, species: 'none' })

    expect(screen.queryByText('CAI')).toBeNull()
    expect(screen.getByText('Codon usage score')).toBeTruthy()
  })

  // The collapsed row counted ✔ marks in the optimizer's text (30 of 31),
  // three lines above the structured report's own "30 of 32".
  it('counts the objectives the same way the report inside does', () => {
    panel(RESULT)

    const passed = RESULT.objectives_report_after.entries.filter(
      (entry) => entry.passes,
    ).length
    const total = RESULT.objectives_report_after.entries.length
    expect(total).toBe(32)
    expect(screen.getByText(`— ${passed} of ${total} passed`)).toBeTruthy()
  })

  // A result saved before the structured report existed: no summary at all
  // rather than a count arrived at by ticking ✔ marks in the text, which was
  // how one row came to say "30 of 31" over the report's own "30 of 32".
  // (The score itself still comes off the text — see result-metrics.test.ts.)
  it('leaves the row unsummarized when there is no structured report', () => {
    panel({
      ...RESULT,
      objectives_report_before: { entries: [], total_score: null },
      objectives_report_after: { entries: [], total_score: null },
    })

    expect(screen.queryByText(/of 3\d passed/)).toBeNull()
  })
})

describe('the exported design', () => {
  // Reproduced: run with split 591, Edit, change the split to 300, download
  // — the report said `"split_point": 300` beside `Main Split Location: 591`.
  it('states the options the run was given, not the form’s current values', async () => {
    panel(RESULT)

    fireEvent.click(screen.getByRole('button', { name: /Download Results/ }))

    await waitFor(() => expect(downloadResultsZip).toHaveBeenCalled())
    const [, exported] = vi.mocked(downloadResultsZip).mock.calls[0]
    expect(JSON.parse(exported.optionsUsed).split_point).toBe(
      RESULT.split_point,
    )
    expect(exported.species).toBe('human')
  })

  // The one paper-ready artifact sat three interactions deep: inside a
  // <details> inside the collapsed "Objectives report" row.
  it('offers the markdown report beside the download', () => {
    panel(RESULT)

    expect(
      screen.getByRole('button', { name: /Copy the design report as Markdown/ })
        .parentElement!.textContent,
    ).toContain('Download Results')
  })

  it('says so when the run’s inputs are no longer stored', async () => {
    panel(RESULT, null)

    fireEvent.click(screen.getByRole('button', { name: /Download Results/ }))

    await waitFor(() => expect(downloadResultsZip).toHaveBeenCalled())
    const [, exported] = vi.mocked(downloadResultsZip).mock.calls[0]
    expect(exported.optionsUsed).toContain('Not recorded')
  })
})

describe('the shape of a completed run', () => {
  // A completed run had no h1–h6 at all: every section title was a button,
  // and the only heading lived in the form, which unmounts when a run starts.
  it('gives a screen reader headings to navigate', () => {
    panel(RESULT)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Results' }),
    ).toBeTruthy()
    const sections = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(sections.some((text) => text?.includes('Junction context'))).toBe(
      true,
    )
    expect(sections.some((text) => text?.includes('What changed'))).toBe(true)
  })
})

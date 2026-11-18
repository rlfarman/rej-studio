// The design tool around a run: which inputs the results are reported
// against, what the form says while a finished run's inputs are being
// edited, and the two ways a run can dead-end.
//
// The form's own fields are mocked out — they are covered by their own
// tests, and what matters here is what the form hands to the results panel
// and what it leaves on screen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import type { FormValues } from '@/features/design-tool/types/form-schema'
import type { ProcessResult } from '@/features/design-tool/types/process-result'

vi.mock('./dna-splicer', () => ({ DNASplicer: () => null }))
vi.mock('./customization-options', () => ({ CustomizationOptions: () => null }))
vi.mock('./optimization-options', () => ({ DesignObjectives: () => null }))
vi.mock('./run-summary', () => ({ RunSummary: () => null }))
vi.mock('./finish-notification-opt-in', () => ({
  FinishNotificationOptIn: () => null,
}))
vi.mock('./cloud-run-toggle', () => ({
  CloudRunToggle: () => <div data-testid="cloud-toggle" />,
}))
vi.mock('./results-panel', () => ({
  ResultsPanel: (props: { result: ProcessResult; runValues: unknown }) => {
    panelProps = props
    return <div data-testid="results-panel" />
  },
}))
vi.mock('@/features/design-tool/hooks/use-job', () => ({
  useJob: () => job,
}))
vi.mock('@/features/design-tool/hooks/use-form-draft', () => ({
  useFormDraft: () => ({
    restored: false,
    clear: vi.fn(),
    discard: vi.fn(),
    dismiss: vi.fn(),
  }),
}))
vi.mock('@/lib/account/account', () => ({
  useAccount: () => ({ status: 'signed-out' }),
}))
vi.mock('@/lib/toast', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}))

import { GeneSplitterForm } from './gene-splitter-form'

let panelProps: { result: ProcessResult; runValues: unknown } | null = null

const RUN_VALUES = {
  sequenceType: 'dna',
  codingSequence: `ATG${'AAA'.repeat(300)}TAA`,
  proteinSequence: '',
  name: 'TP53 run',
  species: 'human',
  codonOptimizeWeight: 1,
  removeCrypticSpliceSites: true,
  removeCrypticSpliceSitesWeight: 1,
  minimizeCpgs: true,
  minimizeCpgsWeight: 1,
  reduceKmerComplexity: true,
  reduceKmerComplexityWeight: 1,
  enforceGcContent: true,
  '5PrimeStimulatoryIntron': true,
  '3PrimeStimulatoryIntron': true,
  selectedWggwSites: [null],
  spliceJunctionPositions: [591],
} as FormValues

const RESULT = {
  name: 'TP53 run',
  original_sequence: RUN_VALUES.codingSequence,
  optimized_sequence: RUN_VALUES.codingSequence,
  seq5: 'ATG',
  seq3: 'TAA',
  split_point: 591,
  used_wggw_as_split: false,
  objectives_before: '',
  objectives_after: '',
  objectives_report_before: { entries: [], total_score: null },
  objectives_report_after: { entries: [], total_score: null },
  wggw_info: null,
  processing_time_seconds: 1.5,
} as ProcessResult

type Job = ReturnType<
  typeof import('@/features/design-tool/hooks/use-job').useJob
>

let job: Job

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    submitJob: vi.fn(),
    cancelJob: vi.fn(),
    jobId: null,
    status: 'idle',
    result: null,
    error: null,
    formValues: null,
    progress: undefined,
    stage: undefined,
    isLoading: false,
    runsInBrowser: true,
    isRestoring: false,
    failedBeforeStart: false,
    cloud: null,
    deleteFromCloud: vi.fn(),
    isDeletingFromCloud: false,
    ...overrides,
  } as Job
}

const completed = () =>
  makeJob({
    jobId: 'browser-1',
    status: 'completed',
    result: RESULT,
    formValues: RUN_VALUES,
  })

beforeEach(() => {
  panelProps = null
  job = makeJob()
})

afterEach(() => cleanup())

/** The lazy results panel resolves a microtask after the first render. */
async function renderForm() {
  const view = render(<GeneSplitterForm draftKey="new" />)
  if (job.result) await screen.findByTestId('results-panel')
  return view
}

describe('what the results are reported against', () => {
  // Reproduced: run with split 591, Edit, change the split to 300, download
  // — one file said `"split_point": 300` in its options and `Main Split
  // Location: 591` in its WGGW block, because the panel was rendered from
  // the stored run but took its options from the live form.
  it('hands the panel the run’s own stored inputs, not the live form', async () => {
    job = completed()
    await renderForm()

    expect(panelProps).not.toBeNull()
    expect(panelProps!.runValues).toBe(RUN_VALUES)
    // No pre-computed options string read off the form on the way in.
    expect(panelProps).not.toHaveProperty('optionsUsed')
  })
})

describe('editing a finished run', () => {
  // The previous run's results sat under the form unlabelled, so inputs
  // were edited while outputs from different inputs were on screen.
  it('says whose results are still on screen', async () => {
    job = completed()
    await renderForm()

    expect(
      screen.queryByRole('heading', { name: /Results of the run/ }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(
      screen.getByRole('heading', { level: 2, name: /Results of the run/ }),
    ).toBeTruthy()
    expect(screen.getByTestId('results-panel')).toBeTruthy()
  })

  // The run button read "✓ Optimization complete" for ~2s after the form
  // reopened, over inputs that had nothing to do with that completion.
  it('does not claim a completion over the reopened form', async () => {
    job = completed()
    await renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const submit = screen.getByRole('button', { name: /Run designer/ })
    expect(submit.textContent).toContain('Run designer')
    expect(screen.queryByText('Optimization complete')).toBeNull()
  })
})

describe('telling a screen reader a run settled', () => {
  // The only live region lived inside the progress card, which unmounts
  // with the run, so completion was never announced.
  it('announces the outcome from outside the progress card', async () => {
    job = makeJob({ jobId: 'browser-1', status: 'running', isLoading: true })
    const { container } = await renderForm()
    const live = container.querySelector('form > [aria-live]')!
    expect(live.textContent).toBe('')

    cleanup()
    job = completed()
    const after = await renderForm()
    expect(
      after.container.querySelector('form > [aria-live]')!.textContent,
    ).toContain('Design complete')
  })
})

describe('a cloud submission refused before it started', () => {
  // The refusal replaced the whole form with a red error naming a toggle
  // that was no longer on screen, and "Run again" repeated the refusal.
  it('keeps the form, and the option it names, on screen', async () => {
    job = makeJob({
      status: 'failed',
      failedBeforeStart: true,
      error: {
        code: 'backend',
        message: 'That sequence is 60,000 bp; cloud designs take up to 50,000.',
        retriable: true,
      },
    })
    await renderForm()

    expect(screen.getByRole('alert').textContent).toContain('60,000 bp')
    expect(screen.getByTestId('cloud-toggle')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Run designer/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Run again' })).toBeNull()
  })
})

describe('a job id this device knows nothing about', () => {
  it('offers a new design instead of editing a blank form', async () => {
    job = makeJob({
      jobId: 'browser-elsewhere',
      status: 'failed',
      error: {
        code: 'not_found',
        message: 'This design ran in a browser…',
        retriable: false,
      },
    })
    await renderForm()

    expect(
      screen.getByRole('button', { name: 'Start a new design' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })
})

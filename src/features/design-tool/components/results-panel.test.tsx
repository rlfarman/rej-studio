// The Run record section of a finished design. No backend in this app writes
// a run record yet, so the collapsed row has to say that rather than invite
// someone to open a section with nothing in it.

import { afterEach, describe, expect, it } from 'vite-plus/test'
import { cleanup, render, screen } from '@testing-library/react'

import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { processResultSchema } from '@/features/design-tool/types/optimizer-contract'
import fixture from '@/features/design-tool/types/process-result.fixture.json'

import { ResultsPanel } from './results-panel'

const RESULT = processResultSchema.parse(fixture) as ProcessResult

afterEach(() => cleanup())

const panel = (result: ProcessResult) =>
  render(
    <ResultsPanel
      result={result}
      optionsUsed="codon optimize"
      species="human"
    />,
  )

describe('the Run record row', () => {
  it('says it was not recorded when the result carries none', () => {
    const { run_record: _dropped, ...withoutRecord } = RESULT
    panel(withoutRecord as ProcessResult)

    expect(screen.getByText(/Not recorded/)).toBeTruthy()
    expect(screen.queryByText(/Repeatable/)).toBeNull()
  })
})

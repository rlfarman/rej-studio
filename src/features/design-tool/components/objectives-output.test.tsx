// The objectives report, summarized. The bullets name real quantities, so
// the optimizer's internal scores must not borrow the name of a published
// index.

import { afterEach, describe, expect, it } from 'vite-plus/test'
import { cleanup, render, screen } from '@testing-library/react'

import type {
  ObjectiveEvaluationEntry,
  ObjectivesReport,
} from '@/features/design-tool/types/process-result'

import { ObjectivesSummary } from './objectives-output'

afterEach(() => cleanup())

const cai = (score: number): ObjectiveEvaluationEntry => ({
  objective: 'MaximizeCAI[0-1500](h_sapiens)',
  passes: false,
  score,
  message: '',
  locations: [],
})

const report = (entries: ObjectiveEvaluationEntry[]): ObjectivesReport => ({
  entries,
  total_score: null,
})

describe('the CAI bullet', () => {
  // It read "CAI: -84.899 → -37.699". A CAI is a ratio in 0–1 by
  // definition; this is the optimizer's own objective score.
  it('names the optimizer’s codon score rather than calling it a CAI', () => {
    render(
      <ObjectivesSummary
        reportBefore={report([cai(-84.899)])}
        reportAfter={report([cai(-37.699)])}
        textBefore=""
        textAfter=""
      />,
    )

    expect(
      screen.getByText('Codon usage objective score: -84.90 → -37.70'),
    ).toBeTruthy()
    expect(screen.queryByText(/^CAI:/)).toBeNull()
    expect(screen.getByText(/not a CAI, which runs 0–1/)).toBeTruthy()
  })
})

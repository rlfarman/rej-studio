import { describe, expect, it } from 'vite-plus/test'

import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { processResultSchema } from '@/features/design-tool/types/optimizer-contract'
import fixture from '@/features/design-tool/types/process-result.fixture.json'

import { computeResultMetrics } from './result-metrics'

const RESULT = processResultSchema.parse(fixture) as ProcessResult

describe('the metrics a finished design is summarized by', () => {
  // The panel read the total out of the optimizer's text summary, which
  // prints it rounded to two places — and counted ✔ marks there for the pass
  // tally, which disagreed with the report's own.
  it('takes the total score from the structured report', () => {
    const metrics = computeResultMetrics(RESULT, 'human')

    expect(metrics.score.before).toBe(
      RESULT.objectives_report_before.total_score,
    )
    expect(metrics.score.after).toBe(RESULT.objectives_report_after.total_score)
  })

  it('falls back to the text total for a result with no structured report', () => {
    const metrics = computeResultMetrics(
      {
        ...RESULT,
        objectives_report_before: { entries: [], total_score: null },
        objectives_report_after: { entries: [], total_score: null },
      },
      'human',
    )

    // The text prints it rounded.
    expect(metrics.score.before).toBe(-17.9)
    expect(metrics.score.after).toBe(-3.55)
  })

  it('reports a CAI inside 0–1, and none without a species', () => {
    const { cai } = computeResultMetrics(RESULT, 'human')

    expect(cai!.after).toBeGreaterThan(0)
    expect(cai!.after).toBeLessThanOrEqual(1)
    expect(computeResultMetrics(RESULT, 'none').cai).toBeNull()
  })
})

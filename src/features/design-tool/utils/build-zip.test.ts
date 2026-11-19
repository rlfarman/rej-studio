import { describe, expect, it } from 'vite-plus/test'
import { unzipSync, strFromU8 } from 'fflate'

import type {
  ProcessResult,
  RunRecord,
} from '@/features/design-tool/types/process-result'

import { buildResultsZipBytes } from './build-zip'

const RUN_RECORD: RunRecord = {
  record_version: 1,
  started_at: '2026-11-16T09:30:00Z',
  duration_seconds: 12.34,
  seed: 20261116,
  input: { sha256: 'ab'.repeat(32), length: 9 },
  options: { codon_optimize: 'h_sapiens', split_point: 6 },
  versions: {
    algorithm_sha256: 'abc123def456',
    dnachisel: '3.2.16',
    python: '3.14.10',
  },
}

const RESULT: ProcessResult = {
  name: 'TP53 run/1',
  original_sequence: 'ATGAAATGA',
  optimized_sequence: 'ATGAAGTGA',
  seq5: 'ATGAAG',
  seq3: 'TGA',
  split_point: 6,
  used_wggw_as_split: false,
  objectives_before: 'before',
  objectives_after: 'after',
  objectives_report_before: { entries: [], total_score: null },
  objectives_report_after: { entries: [], total_score: null },
  wggw_info: null,
  processing_time_seconds: 12.34,
  run_record: RUN_RECORD,
}

function filesIn(result: ProcessResult): Record<string, string> {
  const bytes = buildResultsZipBytes(result, {
    optionsUsed: 'options used',
    species: 'human',
  })
  return Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([name, data]) => [
      name,
      strFromU8(data),
    ]),
  )
}

describe('the exported results', () => {
  it('carry the run record as JSON, named after the sequence', () => {
    const files = filesIn(RESULT)

    expect(Object.keys(files)).toContain('TP53 run_1_run_record.json')
    expect(JSON.parse(files['TP53 run_1_run_record.json'])).toEqual(RUN_RECORD)
  })

  it('put the methods paragraph in the report, so the text file stands alone', () => {
    const report = filesIn(RESULT)['TP53 run_1_report.txt']

    expect(report).toContain('Methods:')
    expect(report).toContain('DNAChisel 3.2.16')
    expect(report).toContain('TP53 run_1_run_record.json')
  })

  // The ZIP's only report was a text dump: no date, no split point as such,
  // and none of the metrics the panel leads with.
  it('carry the report as markdown as well as the legacy text dump', () => {
    const md = filesIn(RESULT)['TP53 run_1_report.md']

    expect(md).toContain('# TP53 run/1')
    expect(md).toContain('| Exported |')
    expect(md).toContain('| Split after base | 6 |')
    expect(md).toContain('## Metrics')
    expect(md).toContain('## Methods')
  })

  it('still export a result that predates run records', () => {
    const { run_record: _run_record, ...older } = RESULT
    const files = filesIn(older as ProcessResult)

    expect(Object.keys(files)).toEqual([
      'TP53 run_1_report.md',
      'TP53 run_1_report.txt',
      'TP53 run_1_sequences.txt',
    ])
    expect(files['TP53 run_1_report.txt']).not.toContain('Methods:')
  })
})

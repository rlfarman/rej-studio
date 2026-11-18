// The exported report. It used to be a text dump with no date, no split
// point as such, none of the metrics the panel leads with, and the objectives
// pasted with DNAChisel's box-drawing gutter the UI strips.

import { describe, expect, it } from 'vite-plus/test'

import type { ProcessResult } from '@/features/design-tool/types/process-result'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { processResultSchema } from '@/features/design-tool/types/optimizer-contract'
import fixture from '@/features/design-tool/types/process-result.fixture.json'

import { buildDesignReportMarkdown } from './design-report'

const RESULT = processResultSchema.parse(fixture) as ProcessResult

const report = (
  result: ProcessResult = RESULT,
  species: DesignToolSpecies = 'human',
) =>
  buildDesignReportMarkdown({
    result,
    optionsUsed: JSON.stringify({ split_point: result.split_point }, null, 2),
    species,
    exportedAt: new Date('2026-11-18T10:00:00Z'),
  })

describe('the exported design report', () => {
  it('dates the file and names the split point and the fragments', () => {
    const md = report()

    expect(md).toContain('| Exported | 2026-11-18T10:00:00.000Z |')
    expect(md).toContain(
      `| Split after base | ${RESULT.split_point.toLocaleString('en-US')} |`,
    )
    expect(md).toMatch(/\| 5′ sequence \| [\d,]+ bp \|/)
    expect(md).toMatch(/\| 3′ sequence \| [\d,]+ bp \|/)
  })

  it('carries the metrics the panel leads with', () => {
    const md = report()

    for (const metric of ['Objective score', 'GC %', 'CpG', 'CAI']) {
      expect(md).toContain(`| ${metric} |`)
    }
    // The structured total, not the text summary's rounded copy.
    expect(md).toContain(RESULT.objectives_report_after.total_score!.toFixed(2))
  })

  it('states the options as applied, verbatim and readable', () => {
    expect(report()).toContain('```json')
    expect(report()).toContain(`"split_point": ${RESULT.split_point}`)
  })

  it('says plainly when no species was chosen', () => {
    const md = report(RESULT, 'none')

    expect(md).toContain('| Codon usage | Not optimized for a species |')
    // No CAI row: without a codon table there is no index to report.
    expect(md).not.toContain('| CAI |')
  })

  it('tables the objectives instead of pasting the box-drawing gutter', () => {
    const md = report()

    expect(md).toContain('## Optimization objectives')
    expect(md).toContain('| Status | Objective | Before | After | Δ | Note |')
    for (const char of ['┍', '├', '│']) expect(md).not.toContain(char)
  })

  it('has no Methods section for a run that recorded no run record', () => {
    expect(RESULT.run_record).toBeUndefined()
    expect(report()).not.toContain('## Methods')
  })
})

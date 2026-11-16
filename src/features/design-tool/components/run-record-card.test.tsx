import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

import type { RunRecord } from '@/features/design-tool/types/process-result'

import { RunRecordCard } from './run-record-card'

afterEach(() => cleanup())

const RECORD: RunRecord = {
  record_version: 1,
  started_at: '2026-11-16T09:30:00Z',
  duration_seconds: 12.34,
  seed: 20261116,
  input: { sha256: 'ab'.repeat(32), length: 1875 },
  options: { codon_optimize: 'h_sapiens', enforce_gc: true, split_point: 900 },
  versions: {
    algorithm_sha256: 'abc123def456',
    dnachisel: '3.2.16',
    python: '3.14.10',
  },
}

const card = (record: RunRecord = RECORD) =>
  render(<RunRecordCard record={record} name="TP53" />)

/** The table of facts, as opposed to the options table or the methods text. */
const factsTable = () =>
  screen.getByText('The facts recorded for this run').closest('table')!

describe('the run record on screen', () => {
  it('shows the facts that identify the run', () => {
    card()

    const facts = within(factsTable())

    expect(facts.getByText('2026-11-16T09:30:00.000Z')).toBeTruthy()
    expect(facts.getByText('12.34 s')).toBeTruthy()
    expect(facts.getByText(/1,875 nt/)).toBeTruthy()
    expect(
      facts.getByText(new RegExp(`SHA-256 ${'ab'.repeat(32)}`)),
    ).toBeTruthy()
    expect(facts.getByText('abc123def456')).toBeTruthy()
    expect(facts.getByText('3.2.16')).toBeTruthy()
  })

  it('leaves out the commit and the corpus when the record has none', () => {
    card()

    expect(screen.queryByText('Commit')).toBeNull()
    expect(screen.queryByText('Gene corpus')).toBeNull()
  })

  it('shows the commit and the corpus when the record has them', () => {
    card({
      ...RECORD,
      versions: { ...RECORD.versions, commit: '05a8be17' },
      corpus_version: 'v1',
    })

    expect(screen.getByText('05a8be17')).toBeTruthy()
    expect(screen.getByText('v1')).toBeTruthy()
  })

  it('lists every option that was applied, as a table', () => {
    card()

    const table = screen
      .getByText('The options applied to this run')
      .closest('table')
    expect(table).not.toBeNull()
    const rows = within(table as HTMLElement).getAllByRole('row')
    // A header row plus one per option.
    expect(rows).toHaveLength(4)
    expect(
      within(table as HTMLElement).getByText('codon_optimize'),
    ).toBeTruthy()
    expect(within(table as HTMLElement).getByText('h_sapiens')).toBeTruthy()
    expect(within(table as HTMLElement).getByText('true')).toBeTruthy()
    expect(within(table as HTMLElement).getByText('900')).toBeTruthy()
  })

  it('gives both tables a caption, so the facts read in order without sight', () => {
    card()

    expect(screen.getByText('The facts recorded for this run')).toBeTruthy()
    expect(screen.getByText('The options applied to this run')).toBeTruthy()
  })

  it('offers the record to copy, to download, and as a methods paragraph', () => {
    card()

    expect(
      screen.getByRole('button', { name: 'Copy the run record as JSON' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: 'Download the run record as a JSON file',
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Copy the methods paragraph' }),
    ).toBeTruthy()
    expect(screen.getByText(/was optimized with/)).toBeTruthy()
  })

  it('says so plainly when a result predates run records', () => {
    render(<RunRecordCard record={undefined} name="TP53" />)

    expect(screen.getByText(/predates run records/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows an unreadable timestamp as it was recorded, rather than a wrong date', () => {
    card({ ...RECORD, started_at: 'not a date' })

    expect(screen.getByText('not a date')).toBeTruthy()
    expect(screen.queryByText(/Invalid Date/)).toBeNull()
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'

import type {
  ObjectiveEvaluationEntry,
  ObjectivesReport,
} from '@/features/design-tool/types/process-result'

import { ObjectiveReplay } from './objective-replay'

afterEach(() => cleanup())

function entry(
  objective: string,
  passes: boolean,
  locations: [number, number][] = [],
): ObjectiveEvaluationEntry {
  return {
    objective,
    passes,
    score: passes ? 0 : -1.5,
    message: `${objective} message`,
    locations: locations.map(([start, end]) => ({ start, end, strand: 1 })),
  }
}

const report = (entries: ObjectiveEvaluationEntry[]): ObjectivesReport => ({
  entries,
  total_score: null,
})

const BEFORE = report([
  entry('AvoidPattern(CG)', false, [
    [10, 12],
    [90, 92],
  ]),
  entry('EnforceGC', true),
  entry('UniquifyAllKmers', false, [[40, 50]]),
])
const AFTER = report([
  entry('AvoidPattern(CG)', true),
  entry('EnforceGC', true),
  entry('UniquifyAllKmers', false, [[44, 54]]),
])

const replay = (before = BEFORE, after = AFTER) =>
  render(
    <ObjectiveReplay
      reportBefore={before}
      reportAfter={after}
      sequenceLength={100}
    />,
  )

describe('stepping through what changed', () => {
  it('opens on the first objective that moved, not the first reported', () => {
    replay()

    expect(screen.getByText('AvoidPattern(CG)')).toBeTruthy()
    expect(screen.getByText('Fixed')).toBeTruthy()
    // Two notable steps: one fixed, one still failing. The one that held is out.
    expect(screen.getByText('1 of 2')).toBeTruthy()
  })

  it('moves with the buttons', () => {
    replay()

    fireEvent.click(screen.getByRole('button', { name: 'Next objective' }))
    expect(screen.getByText('UniquifyAllKmers')).toBeTruthy()
    expect(screen.getByText('2 of 2')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Previous objective' }))
    expect(screen.getByText('AvoidPattern(CG)')).toBeTruthy()
  })

  it('moves with the arrow keys, without tabbing through every control', () => {
    replay()

    // The keys live on the controls, not a focusable wrapper: a focusable
    // group would be a trap for a screen-reader user.
    const next = screen.getByRole('button', { name: 'Next objective' })
    expect(screen.getByRole('group').getAttribute('tabindex')).toBeNull()

    fireEvent.keyDown(next, { key: 'ArrowRight' })
    expect(screen.getByText('UniquifyAllKmers')).toBeTruthy()
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Previous objective' }),
      { key: 'ArrowLeft' },
    )
    expect(screen.getByText('AvoidPattern(CG)')).toBeTruthy()
  })

  it('stops at both ends rather than wrapping', () => {
    replay()

    expect(
      screen.getByRole('button', { name: 'Previous objective' }),
    ).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'Next objective' }))
    expect(
      screen.getByRole('button', { name: 'Next objective' }),
    ).toHaveProperty('disabled', true)
  })

  it('says what each report flagged, as text as well as a picture', () => {
    replay()

    const table = screen
      .getByText('AvoidPattern(CG), before and after optimization')
      .closest('table')
    const rows = within(table as HTMLElement).getAllByRole('row')

    // Header, before, after.
    expect(rows).toHaveLength(3)
    expect(within(rows[1] as HTMLElement).getByText('Failed')).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByText('2')).toBeTruthy()
    expect(within(rows[2] as HTMLElement).getByText('Passed')).toBeTruthy()
    expect(within(rows[2] as HTMLElement).getByText('0')).toBeTruthy()
  })

  it('tells nothing flagged apart from flagged everywhere, for a screen reader', () => {
    replay()

    expect(
      screen.getByRole('img', {
        name: 'Before: 2 regions flagged along the sequence.',
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('img', {
        name: 'After: nothing flagged along the sequence.',
      }),
    ).toBeTruthy()
  })

  it('tallies the run before the reader steps into it', () => {
    replay()

    expect(screen.getByText('Fixed: 1')).toBeTruthy()
    expect(screen.getByText('Still failing: 1')).toBeTruthy()
    expect(screen.getByText('Held: 1')).toBeTruthy()
  })

  it('can take in the objectives that held, on request', () => {
    replay()

    fireEvent.click(
      screen.getByRole('button', { name: /Include the 1 that held/ }),
    )
    expect(screen.getByText('1 of 3')).toBeTruthy()
  })

  it('says so plainly when nothing moved at all', () => {
    const steady = report([entry('EnforceGC', true)])
    replay(steady, steady)

    expect(screen.getByText(/Every objective held/)).toBeTruthy()
  })

  it('does not call a missing final report "everything held"', () => {
    // The backend evaluates the final sequence separately and swallows a
    // failure there. A run with a first report and no second one must not
    // read as a run where nothing changed.
    replay(BEFORE, report([]))

    expect(
      screen.getByText(/not after, so there is nothing to compare/),
    ).toBeTruthy()
    expect(screen.queryByText(/Every objective held/)).toBeNull()
  })

  it('says so when only the final report is there', () => {
    replay(report([]), AFTER)

    expect(
      screen.getByText(/not before, so there is nothing to compare/),
    ).toBeTruthy()
  })

  it('says so plainly when there is no report to step through', () => {
    replay(report([]), report([]))

    expect(screen.getByText(/no objectives report/)).toBeTruthy()
  })
})

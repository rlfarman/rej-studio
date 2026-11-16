import { describe, expect, it } from 'vitest'

import type {
  ObjectiveEvaluationEntry,
  ObjectivesReport,
} from '@/features/design-tool/types/process-result'

import {
  buildObjectiveSteps,
  countOutcomes,
  isNotable,
} from './objective-steps'

function entry(
  objective: string,
  passes: boolean,
  locations: [number, number][] = [],
): ObjectiveEvaluationEntry {
  return {
    objective,
    passes,
    score: passes ? 0 : -1,
    message: `${objective} says something`,
    locations: locations.map(([start, end]) => ({ start, end, strand: 1 })),
  }
}

const report = (entries: ObjectiveEvaluationEntry[]): ObjectivesReport => ({
  entries,
  total_score: null,
})

describe('what the optimizer did to each objective', () => {
  it('calls an objective fixed when it failed before and passes now', () => {
    const [step] = buildObjectiveSteps(
      report([entry('AvoidPattern', false)]),
      report([entry('AvoidPattern', true)]),
    )

    expect(step?.outcome).toBe('fixed')
  })

  it('calls an objective broken when it passed before and fails now', () => {
    const [step] = buildObjectiveSteps(
      report([entry('EnforceGC', true)]),
      report([entry('EnforceGC', false)]),
    )

    expect(step?.outcome).toBe('broken')
  })

  it('tells still failing apart from held', () => {
    const steps = buildObjectiveSteps(
      report([entry('A', false), entry('B', true)]),
      report([entry('A', false), entry('B', true)]),
    )

    expect(steps.map((step) => step.outcome)).toEqual(['unresolved', 'held'])
  })

  it('marks an objective only the later report has as new', () => {
    const [step] = buildObjectiveSteps(report([]), report([entry('New', true)]))

    expect(step).toMatchObject({ outcome: 'added', before: null })
  })

  it('marks an objective only the earlier report has as dropped', () => {
    const [step] = buildObjectiveSteps(
      report([entry('Gone', true)]),
      report([]),
    )

    expect(step).toMatchObject({ outcome: 'dropped', after: null })
  })

  it('counts the regions each report flagged', () => {
    const [step] = buildObjectiveSteps(
      report([
        entry('AvoidPattern', false, [
          [10, 14],
          [80, 84],
        ]),
      ]),
      report([entry('AvoidPattern', false, [[80, 84]])]),
    )

    expect(step).toMatchObject({ flaggedBefore: 2, flaggedAfter: 1 })
  })

  it('lists them in the later report s order, with dropped ones after', () => {
    const steps = buildObjectiveSteps(
      report([entry('Gone', true), entry('B', true)]),
      report([entry('B', true), entry('A', true)]),
    )

    expect(steps.map((step) => step.objective)).toEqual(['B', 'A', 'Gone'])
  })

  it('lists an objective once, however often it is reported', () => {
    const steps = buildObjectiveSteps(
      report([entry('Twice', false), entry('Twice', false)]),
      report([entry('Twice', true), entry('Twice', true)]),
    )

    expect(steps).toHaveLength(1)
  })

  it('finds nothing to step through in two empty reports', () => {
    expect(buildObjectiveSteps(report([]), report([]))).toEqual([])
  })
})

describe('which steps are worth seeing first', () => {
  it('is the ones where something happened, or still is', () => {
    const steps = buildObjectiveSteps(
      report([
        entry('fixed', false),
        entry('held', true),
        entry('stuck', false),
      ]),
      report([
        entry('fixed', true),
        entry('held', true),
        entry('stuck', false),
      ]),
    )

    expect(steps.filter(isNotable).map((step) => step.objective)).toEqual([
      'fixed',
      'stuck',
    ])
  })
})

describe('the tally across a run', () => {
  it('counts every outcome, including the ones that held', () => {
    const counts = countOutcomes(
      buildObjectiveSteps(
        report([entry('a', false), entry('b', true), entry('c', false)]),
        report([entry('a', true), entry('b', false), entry('c', false)]),
      ),
    )

    expect(counts).toMatchObject({
      fixed: 1,
      broken: 1,
      unresolved: 1,
      held: 0,
    })
  })
})

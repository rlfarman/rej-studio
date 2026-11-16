import type {
  ObjectiveEvaluationEntry,
  ObjectivesReport,
} from '@/features/design-tool/types/process-result'

/**
 * What the optimizer did, one objective at a time.
 *
 * The result already says which objectives held before and which hold after,
 * and where each one was unhappy. Side by side that is two long lists; read
 * one objective at a time it is a sequence of changes a person can follow.
 *
 * Nothing here is inferred. There is no record of the order the optimizer
 * worked in, or of any state between the two reports, so these are the two
 * endpoints of each objective and nothing in between. A step says what an
 * objective flagged before and what it flags now; it does not claim to be a
 * moment during the run.
 */

/** How an objective's verdict moved between the two reports. */
export type ObjectiveOutcome =
  /** Failed before, passes now: the optimizer fixed it. */
  | 'fixed'
  /** Passed before, fails now: something else was traded for it. */
  | 'broken'
  /** Failed in both reports. */
  | 'unresolved'
  /** Passed in both reports. */
  | 'held'
  /** Only in the later report: the final sequence is evaluated against more. */
  | 'added'
  /** Only in the earlier report. */
  | 'dropped'

export interface ObjectiveStep {
  objective: string
  outcome: ObjectiveOutcome
  before: ObjectiveEvaluationEntry | null
  after: ObjectiveEvaluationEntry | null
  /** How many regions each report flagged. */
  flaggedBefore: number
  flaggedAfter: number
}

/** The outcomes worth stepping through first: something happened, or still is. */
const NOTABLE: ReadonlySet<ObjectiveOutcome> = new Set([
  'fixed',
  'broken',
  'unresolved',
  'added',
])

function outcomeOf(
  before: ObjectiveEvaluationEntry | undefined,
  after: ObjectiveEvaluationEntry | undefined,
): ObjectiveOutcome {
  if (!before && after) return 'added'
  if (before && !after) return 'dropped'
  if (!before || !after) return 'held'
  if (before.passes === after.passes) {
    return before.passes ? 'held' : 'unresolved'
  }
  return after.passes ? 'fixed' : 'broken'
}

/**
 * Pairs the two reports by objective name, in the order the later report
 * lists them, with anything only in the earlier report after.
 */
export function buildObjectiveSteps(
  reportBefore: ObjectivesReport,
  reportAfter: ObjectivesReport,
): ObjectiveStep[] {
  const before = new Map(reportBefore.entries.map((e) => [e.objective, e]))
  const after = new Map(reportAfter.entries.map((e) => [e.objective, e]))

  const names = [
    ...reportAfter.entries.map((e) => e.objective),
    ...reportBefore.entries
      .map((e) => e.objective)
      .filter((name) => !after.has(name)),
  ]

  const seen = new Set<string>()
  const steps: ObjectiveStep[] = []
  for (const objective of names) {
    if (seen.has(objective)) {
      continue
    }
    seen.add(objective)

    const was = before.get(objective)
    const is = after.get(objective)
    steps.push({
      objective,
      outcome: outcomeOf(was, is),
      before: was ?? null,
      after: is ?? null,
      flaggedBefore: was?.locations.length ?? 0,
      flaggedAfter: is?.locations.length ?? 0,
    })
  }

  return steps
}

/** True when a step is worth looking at before the ones that simply held. */
export function isNotable(step: ObjectiveStep): boolean {
  return NOTABLE.has(step.outcome)
}

/** How many steps fall into each outcome. */
export function countOutcomes(
  steps: ObjectiveStep[],
): Record<ObjectiveOutcome, number> {
  const counts: Record<ObjectiveOutcome, number> = {
    fixed: 0,
    broken: 0,
    unresolved: 0,
    held: 0,
    added: 0,
    dropped: 0,
  }
  for (const step of steps) {
    counts[step.outcome]++
  }
  return counts
}

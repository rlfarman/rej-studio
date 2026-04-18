// Live metrics streamed from the backend during an in-flight run.
// Every field is optional — early polls only carry progress + stage; metric
// fields fill in as the optimizer surfaces them. The frontend treats missing
// fields as "not yet known" and renders placeholders rather than zeros.

export interface RunObjective {
  name: string
  done: boolean
}

export interface RunMutationHint {
  start: number
  end: number
}

export interface RunMetrics {
  iteration?: number
  gcPercent?: number
  cpgCount?: number
  score?: number | null
  objectivesTotal?: number
  objectivesPassing?: number
  objectives?: RunObjective[]
  mutationHint?: RunMutationHint
}

interface BackendMetricsRaw {
  iteration?: number
  gc_percent?: number
  cpg_count?: number
  score?: number | null
  objectives_total?: number
  objectives_passing?: number
  objectives?: Array<{ name?: unknown; done?: unknown }>
  mutation_hint?: { start?: unknown; end?: unknown }
}

/** Coerce the snake_case payload Modal returns into the camelCase frontend
 * shape, defensively dropping anything that doesn't match the expected types.
 * Defensive parsing matters here: `progress_dict` is opaque to FastAPI and
 * could carry partial or malformed entries from older worker versions. */
export function parseRunMetrics(raw: unknown): RunMetrics | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as BackendMetricsRaw
  const out: RunMetrics = {}
  if (typeof r.iteration === 'number') out.iteration = r.iteration
  if (typeof r.gc_percent === 'number') out.gcPercent = r.gc_percent
  if (typeof r.cpg_count === 'number') out.cpgCount = r.cpg_count
  if (typeof r.score === 'number' || r.score === null) out.score = r.score
  if (typeof r.objectives_total === 'number')
    out.objectivesTotal = r.objectives_total
  if (typeof r.objectives_passing === 'number')
    out.objectivesPassing = r.objectives_passing
  if (Array.isArray(r.objectives)) {
    out.objectives = r.objectives
      .filter((o) => typeof o?.name === 'string')
      .map((o) => ({ name: o.name as string, done: Boolean(o.done) }))
  }
  if (
    r.mutation_hint &&
    typeof r.mutation_hint.start === 'number' &&
    typeof r.mutation_hint.end === 'number' &&
    r.mutation_hint.end > r.mutation_hint.start
  ) {
    out.mutationHint = {
      start: r.mutation_hint.start,
      end: r.mutation_hint.end,
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

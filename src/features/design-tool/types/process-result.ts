export interface WggwSiteInfo {
  position: number
  motif: string
  distance_from_split: number
  original_codons: [string, string]
  new_codons: [string, string]
}

interface ObjectiveLocation {
  start: number
  end: number
  strand: number | null
}

export interface ObjectiveEvaluationEntry {
  objective: string
  passes: boolean
  score: number
  message: string
  locations: ObjectiveLocation[]
}

export interface ObjectivesReport {
  entries: ObjectiveEvaluationEntry[]
  total_score: number | null
}

/** The sequence that went in, identified without being copied again. */
export interface RunRecordInput {
  sha256: string
  length: number
}

/** What produced the result: the code and the libraries, pinned. */
export interface RunRecordVersions {
  algorithm_sha256: string
  dnachisel: string
  python: string
  /**
   * Present when the deployment knows its own commit. Absent from Modal,
   * which returns the record as built; null from FastAPI, which fills in
   * optional fields. Either way, falsy means unknown.
   */
  commit?: string | null
}

/**
 * What a run was, in enough detail to repeat or cite it.
 *
 * Built by the Python backend (`python/run_record.py`); every field is a fact
 * about the run, so anything shown to the user is derived from these and
 * nothing else. A run is reproducible from this record: the optimizer consumes
 * no randomness, which is why there is no seed.
 */
export interface RunRecord {
  record_version: number
  /** ISO 8601, UTC. */
  started_at: string
  duration_seconds: number
  input: RunRecordInput
  /** The options as applied, after validation and defaults. */
  options: Record<string, unknown>
  versions: RunRecordVersions
  /**
   * The gene corpus the sequence came from. Falsy for a pasted sequence, and
   * for a database whose dataset the deployment has not named; see
   * `api/corpus-version.ts`.
   */
  corpus_version?: string | null
}

export interface ProcessResult {
  name: string
  original_sequence: string
  optimized_sequence: string
  seq5: string
  seq3: string
  split_point: number
  used_wggw_as_split: boolean
  objectives_before: string
  objectives_after: string
  objectives_report_before: ObjectivesReport
  objectives_report_after: ObjectivesReport
  wggw_info: Record<string, WggwSiteInfo> | null
  processing_time_seconds: number
  /**
   * Optional only for results produced before run records existed, which may
   * still be held in a browser's recent jobs. Every new run carries one.
   */
  run_record?: RunRecord
}

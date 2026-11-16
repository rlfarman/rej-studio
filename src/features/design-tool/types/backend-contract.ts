/**
 * Zod mirrors of the Python/Modal job API contract.
 *
 * Source of truth for the shapes below:
 *   - `python/index.py` — ProcessOptions, SelectedWggwSite, ProcessResult,
 *     ObjectivesReport, ObjectiveEvaluationEntry, WggwSiteInfo
 *   - `modal/app.py` — JobRequest, JobResponse, JobStatus, JobError
 *   - `python/algorithm.py` — `process_single_request_json` return payload
 *
 * Every response crossing the network is parsed with these schemas, so a
 * backend change shows up as one validation error here rather than as
 * `undefined` three layers into the UI.
 */

import { z } from 'zod'

// --- Request: options ------------------------------------------------------
// Mirrors ProcessOptions. `.passthrough()` is deliberately NOT used: an
// unknown option would be silently dropped by Pydantic anyway, and catching
// it here surfaces a frontend/backend drift early.

// Bounds mirror `SelectedWggwSite` in python/contracts.py exactly: that
// model is `extra="forbid"`, so an unknown or out-of-range field is a 422
// rather than something the solver quietly ignores.
const codonSchema = z.string().regex(/^[ACGTU]{3}$/i)

const selectedWggwSiteSchema = z.object({
  position: z.number().int().nonnegative(),
  motif_start: z.number().int().nonnegative(),
  motif: z
    .string()
    .min(1)
    .max(16)
    .regex(/^[ACGTU]+$/i),
  hexamer_start: z.number().int().min(1),
  original_codons: z.tuple([codonSchema, codonSchema]),
  new_codons: z.tuple([codonSchema, codonSchema]),
  new_hexamer: z.string().regex(/^[ACGTU]{6}$/i),
})

// Weights feed DNAChisel's `boost` parameters; python/contracts.py bounds
// them at 0–100.
const weight = z.number().min(0).max(100)

const MAX_CDS_LENGTH = 50_000

/**
 * Mirror of `ProcessOptions` in python/contracts.py.
 *
 * That model is `extra="forbid"`, so a key we invent here would come back as
 * a 422 in production — which is also why `split_points` /
 * `selected_wggw_sites` are absent: more than one junction is rejected, and
 * `form-handler.ts` never emits them. Unknown keys from a caller are dropped
 * by this parse rather than forwarded.
 */
export const processOptionsSchema = z.object({
  // 'human' | 'mouse' are the only values algorithm.py maps to a codon table
  // (speciesmap in algorithm.py); null disables codon optimization.
  codon_optimize: z.enum(['human', 'mouse']).nullable(),
  codon_optimize_weight: weight,
  remove_cryptic_ss: z.boolean(),
  remove_cryptic_ss_weight: weight,
  minimize_CpGs: z.boolean(),
  minimize_CpGs_weight: weight,
  reduce_kmer_complexity: z.boolean(),
  reduce_kmer_complexity_weight: weight,
  // k for UniquifyAllKmers. Optional: the backend defaults it to 10, and
  // below ~6 the objective is unsatisfiable on a real CDS.
  reduce_kmer_complexity_k: z.number().int().min(6).max(100).optional(),
  enforce_gc: z.boolean(),
  stim_5: z.boolean(),
  stim_3: z.boolean(),
  // null means "halfway through the sequence" (the algorithm's default).
  split_point: z.number().int().nonnegative().nullable(),
  selected_wggw_site: selectedWggwSiteSchema.nullable(),
  ensure_wggw: z.boolean(),
  wggw_threshold: z.number().int().nonnegative().max(MAX_CDS_LENGTH),
  // Deterministic runs: omitted means "derive one and echo it back".
  seed: z
    .number()
    .int()
    .min(0)
    .max(2 ** 32 - 1)
    .optional(),
})

export type ProcessOptions = z.infer<typeof processOptionsSchema>

// --- Response: optimization result ----------------------------------------

const objectiveLocationSchema = z.object({
  start: z.number(),
  end: z.number(),
  strand: z.number().nullable().default(null),
})

export const objectiveEvaluationEntrySchema = z.object({
  objective: z.string(),
  passes: z.boolean(),
  score: z.number(),
  message: z.string(),
  locations: z.array(objectiveLocationSchema).default([]),
})

export const objectivesReportSchema = z.object({
  entries: z.array(objectiveEvaluationEntrySchema).default([]),
  total_score: z.number().nullable().default(null),
})

export const wggwSiteInfoSchema = z.object({
  position: z.number(),
  motif: z.string(),
  distance_from_split: z.number(),
  original_codons: z.tuple([z.string(), z.string()]),
  new_codons: z.tuple([z.string(), z.string()]),
})

/** The sequence that went in, identified without being copied again. */
const runRecordInputSchema = z.object({
  sha256: z.string(),
  length: z.number(),
})

/** What produced the result: the code and the libraries, pinned. */
const runRecordVersionsSchema = z.object({
  algorithm_sha256: z.string(),
  dnachisel: z.string(),
  python: z.string(),
  /**
   * Present when the deployment knows its own commit. Absent from Modal,
   * which returns the record as built; null from FastAPI, which fills in
   * optional fields. Either way, falsy means unknown.
   */
  commit: z.string().nullable().optional(),
})

/**
 * What a run was, in enough detail to repeat or cite it.
 *
 * Built by the Python backend (`python/run_record.py`); every field is a fact
 * about the run, so anything shown to the user is derived from these and
 * nothing else. A run is repeatable from this record: submitting the same
 * sequence and options with the recorded seed reproduces the design.
 */
export const runRecordSchema = z.object({
  record_version: z.number(),
  /** ISO 8601, UTC. */
  started_at: z.string(),
  duration_seconds: z.number(),
  /** The seed the run used, supplied or derived by the backend. */
  seed: z.number(),
  input: runRecordInputSchema,
  /** The options as applied, after validation and defaults. */
  options: z.record(z.string(), z.unknown()),
  versions: runRecordVersionsSchema,
  /**
   * The gene corpus the sequence came from. Falsy for a pasted sequence, and
   * for a database whose dataset the deployment has not named; see
   * `api/corpus-version.ts`.
   */
  corpus_version: z.string().nullable().optional(),
})

export const processResultSchema = z.object({
  name: z.string(),
  // Non-empty sequences: when the optimizer catches its own exception it
  // still answers HTTP 200, with empty sequences and the error text in
  // `objectives_after`. Requiring content turns that into a clear failure
  // instead of a "completed" run with nothing in it.
  original_sequence: z.string().min(1),
  optimized_sequence: z.string().min(1),
  seq5: z.string().min(1),
  seq3: z.string().min(1),
  split_point: z.number(),
  used_wggw_as_split: z.boolean(),
  objectives_before: z.string(),
  objectives_after: z.string(),
  objectives_report_before: objectivesReportSchema.default({
    entries: [],
    total_score: null,
  }),
  objectives_report_after: objectivesReportSchema.default({
    entries: [],
    total_score: null,
  }),
  wggw_info: z.record(z.string(), wggwSiteInfoSchema).nullable().default(null),
  processing_time_seconds: z.number(),
  // Echoed RNG seed, so a run can be reproduced. Older backends omit it.
  seed: z.number().nullable().optional(),
  // Optional only for results produced before run records existed, which may
  // still be held in a browser's recent jobs. Every new run carries one.
  run_record: runRecordSchema.optional(),
})

export type BackendProcessResult = z.infer<typeof processResultSchema>

// --- Response: job lifecycle ----------------------------------------------

/**
 * Job failure codes.
 *
 * The backend emits `timeout | invalid_input | backend | cancelled |
 * not_found | unknown`; `network`, `rate_limited` and `unauthorized` are
 * added by this side (an unreachable backend, our own submit rate limit, a
 * rejected token or an expired session). An unrecognized code — a newer
 * backend than this client — collapses to 'unknown' rather than failing the
 * whole parse.
 */
const jobErrorCodeSchema = z
  .enum([
    'timeout',
    'invalid_input',
    'backend',
    'cancelled',
    'not_found',
    'network',
    'rate_limited',
    'unauthorized',
    'unknown',
  ])
  .catch('unknown')

export type JobErrorCode = z.infer<typeof jobErrorCodeSchema>

export const jobErrorSchema = z.object({
  code: jobErrorCodeSchema,
  message: z.string(),
  retriable: z.boolean(),
})

export type BackendJobError = z.infer<typeof jobErrorSchema>

export const jobSubmitResponseSchema = z.object({
  call_id: z.string().min(1),
})

export const jobStatusResponseSchema = z.object({
  status: z.enum(['running', 'completed', 'failed', 'cancelled', 'not_found']),
  result: processResultSchema.nullable().optional(),
  error: jobErrorSchema.nullable().optional(),
  progress: z.number().min(0).max(1).nullable().optional(),
  stage: z.string().nullable().optional(),
})

export type JobStatusResponse = z.infer<typeof jobStatusResponseSchema>

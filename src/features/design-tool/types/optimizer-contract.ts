/**
 * The in-browser optimizer's request and result shapes.
 *
 * Source of truth: `rust/optimizer/src/contract.rs`. Field names keep the
 * spelling the retired Python backend used (`minimize_CpGs`, `stim_5`), so
 * results saved from either read the same.
 *
 * The worker's result is parsed with `processResultSchema`, so a change on
 * the Rust side shows up as one validation error here rather than as
 * `undefined` three layers into the UI.
 */

import { z } from 'zod'

// --- Request: options ------------------------------------------------------

/** A caller-chosen WGGW site, as the motif picker sends it. */
interface SelectedWggwSiteOptions {
  position: number
  motif_start: number
  motif: string
  /** 1-based. */
  hexamer_start: number
  original_codons: [string, string]
  new_codons: [string, string]
  new_hexamer: string
}

/**
 * Everything the optimizer can be asked to do (`ProcessOptions` in
 * contract.rs). The form validates the values; `form-handler.ts` builds this.
 * One split point only: the optimizer has no field for a second.
 */
export interface ProcessOptions {
  /** null leaves codon usage alone. */
  codon_optimize: 'human' | 'mouse' | null
  codon_optimize_weight: number
  remove_cryptic_ss: boolean
  remove_cryptic_ss_weight: number
  minimize_CpGs: boolean
  minimize_CpGs_weight: number
  reduce_kmer_complexity: boolean
  reduce_kmer_complexity_weight: number
  /** k for UniquifyAllKmers; the optimizer defaults it to 10. */
  reduce_kmer_complexity_k?: number
  enforce_gc: boolean
  stim_5: boolean
  stim_3: boolean
  /** null means "halfway through the sequence". */
  split_point: number | null
  selected_wggw_site: SelectedWggwSiteOptions | null
  ensure_wggw: boolean
  wggw_threshold: number
  /** Deterministic runs: omitted means "derive one and echo it back". */
  seed?: number
}

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
  /** Falsy means unknown. */
  commit: z.string().nullable().optional(),
})

/**
 * What a run was, in enough detail to repeat or cite it.
 *
 * Built by the retired Python backend (`python/run_record.py`, deleted in
 * step 4 of docs/cloudflare-migration.md) for server runs, which designs
 * saved in a browser's history still carry. The Rust optimizer does not
 * return one yet. Every field is a fact about the run, so anything shown to
 * the user is derived from these and nothing else.
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
   * The gene dataset the deployment was serving when the run happened — a
   * fact about the deployment, not about where the sequence came from. Falsy
   * when the dataset had not been named.
   */
  corpus_version: z.string().nullable().optional(),
})

export const processResultSchema = z.object({
  name: z.string(),
  // Non-empty sequences: a result with nothing in it is a failure, not a
  // "completed" run.
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
  // Echoed RNG seed, so a run can be reproduced.
  seed: z.number().nullable().optional(),
  // Only server runs carried one (see runRecordSchema).
  run_record: runRecordSchema.optional(),
})

// --- Failures ---------------------------------------------------------------

/**
 * Design failure codes: what the in-browser run reports (`invalid_input`,
 * `backend`), a cancelled run, a `?job=` this browser has no record of, and
 * anything else. An unrecognized code (one the retired server backends
 * wrote, in an imported backup) collapses to 'unknown' rather than failing
 * the whole parse.
 */
const jobErrorCodeSchema = z
  .enum(['invalid_input', 'backend', 'cancelled', 'not_found', 'unknown'])
  .catch('unknown')

export type JobErrorCode = z.infer<typeof jobErrorCodeSchema>

export const jobErrorSchema = z.object({
  code: jobErrorCodeSchema,
  message: z.string(),
  retriable: z.boolean(),
})

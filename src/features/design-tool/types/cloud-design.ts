/**
 * Cloud designs: the contract between the design tool, the Worker's
 * cloud-design server functions (`api/cloud-designs.functions.ts`) and the MCP
 * endpoint's hand-off.
 *
 * A cloud design runs the same `.wasm` the tab runs, in a Cloudflare Workflow,
 * so the person can close the tab (docs/cloudflare-migration.md, "Plan: cloud
 * designs"). The request is the design form's own values, validated by the
 * form's own schema on both sides, so a design the form would refuse is
 * refused by the Worker too.
 */

import { z } from 'zod'

import { validationSchema } from './form-schema'
import { jobErrorSchema, processResultSchema } from './optimizer-contract'

/**
 * The longest coding sequence a cloud design takes, in bases.
 *
 * A Workflow step gets at most 5 minutes of CPU, and the optimizer's time
 * grows with the square of the sequence (see `estimateCloudSeconds`): 45 kb
 * comes to about 4.9 minutes, the most one step can hold. Checked by the form
 * before it submits and by the Worker before it starts anything.
 */
export const CLOUD_DESIGN_MAX_BASES = 45_000

/**
 * How long a finished cloud design is kept, in days: the Paid plan's maximum
 * Workflow retention. Failures are kept for `CLOUD_DESIGN_ERROR_RETENTION_DAYS`.
 */
export const CLOUD_DESIGN_RETENTION_DAYS = 30
export const CLOUD_DESIGN_ERROR_RETENTION_DAYS = 7

/**
 * Seconds of optimizer time per square kilobase, measured with the committed
 * `.wasm` on workerd: 1.2 kb 0.2 s, 6 kb 4.8 s, 12 kb 21 s, 18 kb 48 s
 * (src/server/mcp/server.ts) — each within 10% of 0.145 s × kb².
 */
const SECONDS_PER_SQUARE_KB = 0.145

/** Queueing, instantiation and the round trips around the step itself. */
const OVERHEAD_SECONDS = 3

/**
 * About how long a cloud design of this many bases takes, in seconds.
 *
 * An estimate from the measured scaling, not a progress report: a Workflow
 * step cannot stream progress out, so the UI shows this instead of a bar.
 */
export function estimateCloudSeconds(bases: number): number {
  const kb = Math.max(0, bases) / 1000
  return Math.round(OVERHEAD_SECONDS + SECONDS_PER_SQUARE_KB * kb * kb)
}

/**
 * A cloud design's id: SHA-256, as 64 lowercase hex digits, of the canonical
 * request and the optimizer's digest (src/server/designs/id.ts). Anything
 * else is a design id from this browser (`browser-…`) or nothing at all.
 */
const CLOUD_DESIGN_ID = /^[0-9a-f]{64}$/

export function isCloudDesignId(id: string): boolean {
  return CLOUD_DESIGN_ID.test(id)
}

/** A submission: the form's values, and an optional fixed seed. */
export const cloudDesignSubmitSchema = z.object({
  values: validationSchema,
  seed: z.number().int().optional(),
})

/** Where a cloud design is. A Workflow's finer states fold into these four. */
const cloudDesignStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
])

export type CloudDesignStatus = z.infer<typeof cloudDesignStatusSchema>

/**
 * A cloud design, as reading it reports it.
 *
 * What is known depends on how far it has got: a queued instance has only its
 * id and status; once it starts, its inputs are readable; once it finishes,
 * the result or the reason it failed. `values` is the form's input, so a
 * `?job=` link can show the inputs as well as the result.
 */
export const cloudDesignSchema = z.object({
  id: z.string(),
  status: cloudDesignStatusSchema,
  name: z.string().optional(),
  bases: z.number().optional(),
  submittedAt: z.string().optional(),
  /** Who submitted it: an email, or `mcp:<token name>` for an agent. */
  owner: z.string().optional(),
  /** Whether the caller is the owner, i.e. may delete it. */
  ownedByCaller: z.boolean().optional(),
  values: validationSchema.optional(),
  result: processResultSchema.optional(),
  error: jobErrorSchema.optional(),
})

export type CloudDesign = z.infer<typeof cloudDesignSchema>

/** A submission's answer: the id, and whether it already existed. */
const cloudDesignSubmittedSchema = z.object({
  id: z.string(),
  status: cloudDesignStatusSchema,
  /** True when an identical request had already been submitted. */
  existing: z.boolean(),
})

export type CloudDesignSubmitted = z.infer<typeof cloudDesignSubmittedSchema>

/** Every refusal from the cloud-design server functions has this shape. */
export const cloudDesignRefusalSchema = z.object({ error: z.string() })

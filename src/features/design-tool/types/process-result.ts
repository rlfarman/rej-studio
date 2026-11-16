/**
 * UI-facing types for an optimization result.
 *
 * These are inferred from the zod schemas in `backend-contract.ts` so the
 * types the components consume can't drift from what we actually parse off
 * the wire.
 */

import type {
  BackendProcessResult,
  objectiveEvaluationEntrySchema,
  objectivesReportSchema,
  wggwSiteInfoSchema,
} from '@/features/design-tool/types/backend-contract'
import type { z } from 'zod'

export type WggwSiteInfo = z.infer<typeof wggwSiteInfoSchema>
export type ObjectiveEvaluationEntry = z.infer<
  typeof objectiveEvaluationEntrySchema
>
export type ObjectivesReport = z.infer<typeof objectivesReportSchema>
export type ProcessResult = BackendProcessResult

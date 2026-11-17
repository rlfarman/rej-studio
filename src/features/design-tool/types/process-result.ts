/**
 * UI-facing types for an optimization result.
 *
 * Inferred from the zod schemas in `optimizer-contract.ts` so the types the
 * components consume can't drift from what is actually parsed.
 */

import type {
  objectiveEvaluationEntrySchema,
  objectivesReportSchema,
  processResultSchema,
  runRecordSchema,
  wggwSiteInfoSchema,
} from '@/features/design-tool/types/optimizer-contract'
import type { z } from 'zod'

export type WggwSiteInfo = z.infer<typeof wggwSiteInfoSchema>
export type ObjectiveEvaluationEntry = z.infer<
  typeof objectiveEvaluationEntrySchema
>
export type ObjectivesReport = z.infer<typeof objectivesReportSchema>
export type RunRecord = z.infer<typeof runRecordSchema>
export type ProcessResult = z.infer<typeof processResultSchema>

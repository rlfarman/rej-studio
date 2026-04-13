import { z } from 'zod'

/** Shared optimization options for all sequences in a batch. */
export const batchOptionsSchema = z.object({
  species: z.enum(['none', 'human', 'mouse']),
  codonOptimizeWeight: z.number().min(0).max(100),
  removeCrypticSpliceSites: z.boolean(),
  removeCrypticSpliceSitesWeight: z.number().min(0).max(100),
  minimizeCpgs: z.boolean(),
  minimizeCpgsWeight: z.number().min(0).max(100),
  reduceKmerComplexity: z.boolean(),
  reduceKmerComplexityWeight: z.number().min(0).max(100),
  enforceGcContent: z.boolean(),
  '5PrimeStimulatoryIntron': z.boolean(),
  '3PrimeStimulatoryIntron': z.boolean(),
})

export type BatchOptions = z.infer<typeof batchOptionsSchema>

export const BATCH_OPTIONS_DEFAULTS: BatchOptions = {
  species: 'none',
  codonOptimizeWeight: 1,
  removeCrypticSpliceSites: true,
  removeCrypticSpliceSitesWeight: 1,
  minimizeCpgs: true,
  minimizeCpgsWeight: 1,
  reduceKmerComplexity: true,
  reduceKmerComplexityWeight: 1,
  enforceGcContent: true,
  '5PrimeStimulatoryIntron': true,
  '3PrimeStimulatoryIntron': true,
}

import { z } from 'zod'
import { SpeciesValues } from '@/design-tool/types/species-options'

export const validationSchema = z.object({
  codingSequence: z
    .string()
    .nonempty('Coding sequence is required.')
    .regex(
      /^[ACGTUacgtu]+$/,
      'Invalid coding sequence. Must contain only A, C, G, T, or U.',
    )
    .refine((value) => value.length % 3 === 0, {
      message: 'Invalid coding sequence. Must be a multiple of 3.',
    }),
  name: z
    .string()
    .nonempty('A name is required.')
    .max(250, 'Must be less than 250 characters'),
  species: z.enum([
    SpeciesValues.None,
    SpeciesValues.Human,
    SpeciesValues.Mouse,
  ]),
  codonOptimizeWeight: z.number().min(0).max(100).default(1),
  removeCrypticSpliceSites: z.boolean(),
  removeCrypticSpliceSitesWeight: z.number().min(0).max(100).default(1),
  minimizeCpgs: z.boolean().default(true),
  minimizeCpgsWeight: z.number().min(0).max(100).default(1),
  reduceKmerComplexity: z.boolean().default(true),
  reduceKmerComplexityWeight: z.number().min(0).max(100).default(1),
  enforceGcContent: z.boolean().default(true),
  '5PrimeStimulatoryIntron': z.boolean().default(true),
  '3PrimeStimulatoryIntron': z.boolean().default(true),
  spliceJunctionPosition: z.number().min(1),
})

export type FormValues = z.infer<typeof validationSchema>

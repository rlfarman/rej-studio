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
    .max(50000, 'Coding sequence must be 50,000 characters or fewer.')
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
  spliceJunctionPosition: z.number().min(1),
})

export type FormValues = z.infer<typeof validationSchema>

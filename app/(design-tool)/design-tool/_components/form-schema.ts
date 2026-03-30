import { z } from 'zod'

export const validationSchema = z.object({
  codingSequence: z
    .string()
    .nonempty('Coding sequence is required.')
    .regex(
      /^[ACGTUacgtu]+$/,
      'Sequence must contain only valid nucleotides (A, C, G, T, or U).',
    )
    .max(50000, 'Sequence must be 50,000 characters or fewer.')
    .refine((value) => value.length % 3 === 0, {
      message: 'Sequence length must be a multiple of 3 (complete codons).',
    }),
  name: z
    .string()
    .nonempty('A name is required.')
    .max(250, 'Name must be 250 characters or fewer.'),
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
  spliceJunctionPosition: z.number().min(1),
})

export type FormValues = z.infer<typeof validationSchema>

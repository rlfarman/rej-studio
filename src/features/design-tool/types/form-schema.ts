import { z } from 'zod'

const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA', 'UAA', 'UAG', 'UGA'])
const CODON_REGEX = /^[ACGTUacgtu]{3}$/
const WGGW_REGEX = /^[ATU]GG[ATU]$/i

function findInternalStopCodons(seq: string): number[] {
  const upper = seq.toUpperCase()
  const positions: number[] = []
  // Check every codon except the last (which should be a stop codon)
  const lastCodonStart = upper.length - 3
  for (let i = 0; i < lastCodonStart; i += 3) {
    if (STOP_CODONS.has(upper.slice(i, i + 3))) {
      positions.push(i)
    }
  }
  return positions
}

export const validationSchema = z
  .object({
    selectedWggwSite: z
      .object({
        position: z.number().int().min(1),
        motifStart: z.number().int().min(1),
        motif: z.string().regex(WGGW_REGEX),
        hexamerStart: z.number().int().min(1),
        originalCodons: z.tuple([
          z.string().regex(CODON_REGEX),
          z.string().regex(CODON_REGEX),
        ]),
        newCodons: z.tuple([
          z.string().regex(CODON_REGEX),
          z.string().regex(CODON_REGEX),
        ]),
        newHexamer: z.string().regex(/^[ACGTUacgtu]{6}$/),
      })
      .nullable()
      .optional(),
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
      })
      .refine(
        (value) => {
          const first3 = value.slice(0, 3).toUpperCase()
          return first3 === 'ATG' || first3 === 'AUG'
        },
        {
          message:
            'Sequence must begin with a start codon (ATG). Without it, translation cannot initiate.',
        },
      )
      .refine(
        (value) => {
          if (value.length < 3) return true
          const last3 = value.slice(-3).toUpperCase()
          return STOP_CODONS.has(last3)
        },
        {
          message:
            'Sequence must end with a stop codon (TAA, TAG, or TGA). Without it, the ribosome will read through into downstream sequence.',
        },
      )
      .refine(
        (value) => {
          if (value.length < 6) return true
          return findInternalStopCodons(value).length === 0
        },
        {
          message:
            'Sequence contains premature stop codon(s) in the reading frame. This will produce a truncated protein.',
        },
      ),
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
  .superRefine((data, ctx) => {
    // Cross-field: the splice position must lie strictly inside the coding
    // sequence (1 ≤ position ≤ length - 1). The per-field schema only
    // enforces the lower bound because the upper bound depends on
    // codingSequence.length.
    const max = data.codingSequence.length - 1
    if (data.spliceJunctionPosition > max) {
      ctx.addIssue({
        path: ['spliceJunctionPosition'],
        code: z.ZodIssueCode.custom,
        message: `Split position must be ≤ ${max} (sequence length − 1).`,
      })
    }
    if (
      data.selectedWggwSite &&
      data.selectedWggwSite.position !== data.spliceJunctionPosition
    ) {
      ctx.addIssue({
        path: ['selectedWggwSite'],
        code: z.ZodIssueCode.custom,
        message:
          'Selected WGGW site must match the current splice junction position.',
      })
    }
  })

export type FormValues = z.infer<typeof validationSchema>
export type SelectedWggwSite = NonNullable<FormValues['selectedWggwSite']>

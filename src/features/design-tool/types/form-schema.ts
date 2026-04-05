import { z } from 'zod'
import {
  BIO_ALPHABET_REGEX,
  detectSequenceType,
  effectiveDnaLength,
} from '@/lib/bio/sequence-type'

const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA', 'UAA', 'UAG', 'UGA'])

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
    codingSequence: z
      .string()
      .nonempty('Coding sequence is required.')
      .regex(
        BIO_ALPHABET_REGEX,
        'Sequence must contain only valid nucleotides (A, C, G, T, U) or amino acids (ACDEFGHIKLMNPQRSTVWY*).',
      )
      .max(50000, 'Sequence must be 50,000 characters or fewer.')
      .refine(
        (value) =>
          detectSequenceType(value) === 'protein' || value.length % 3 === 0,
        {
          message: 'Sequence length must be a multiple of 3 (complete codons).',
        },
      )
      .refine(
        (value) => {
          if (detectSequenceType(value) === 'protein') return true
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
          if (detectSequenceType(value) === 'protein') return true
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
          if (detectSequenceType(value) === 'protein') return true
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
    // codingSequence.length (× 3 for amino-acid input, which is
    // reverse-translated to DNA before optimization).
    const max = effectiveDnaLength(data.codingSequence) - 1
    if (data.spliceJunctionPosition > max) {
      ctx.addIssue({
        path: ['spliceJunctionPosition'],
        code: z.ZodIssueCode.custom,
        message: `Split position must be ≤ ${max} (sequence length − 1).`,
      })
    }
  })

export type FormValues = z.infer<typeof validationSchema>

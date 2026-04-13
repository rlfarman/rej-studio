import { z } from 'zod'

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

export type SequenceType = 'dna' | 'protein'

const PROTEIN_RE = /^[ACDEFGHIKLMNPQRSTVWYacdefghiklmnpqrstvwy*]+$/

const dnaSequenceSchema = z
  .string()
  .nonempty('Coding sequence is required.')
  .regex(
    /^[ACGTUacgtu]+$/,
    'Sequence must contain only valid nucleotides (A, C, G, T, or U).',
  )
  .max(50000, 'Sequence must be 50,000 characters or fewer.')
  .transform((v) => v.toUpperCase())
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
  )

const proteinSequenceSchema = z
  .string()
  .nonempty('Protein sequence is required.')
  .max(16666, 'Protein sequence must be 16,666 residues or fewer.')
  .refine((v) => PROTEIN_RE.test(v), {
    message:
      'Sequence must contain only standard amino acid letters (A, C, D, E, F, G, H, I, K, L, M, N, P, Q, R, S, T, V, W, Y) or * for stop.',
  })
  .transform((v) => v.toUpperCase())
  .refine(
    (value) => {
      // No internal stop characters — only trailing * is allowed
      const body = value.endsWith('*') ? value.slice(0, -1) : value
      return !body.includes('*')
    },
    {
      message:
        'Sequence contains internal stop character(s) (*). Only a terminal * is allowed.',
    },
  )

export const validationSchema = z
  .object({
    sequenceType: z.enum(['dna', 'protein']),
    codingSequence: z.string(),
    proteinSequence: z.string(),
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
    // Validate the active sequence field based on sequenceType
    if (data.sequenceType === 'dna') {
      const result = dnaSequenceSchema.safeParse(data.codingSequence)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({ ...issue, path: ['codingSequence'] })
        }
      } else {
        // Apply the transformed (uppercased) value
        data.codingSequence = result.data
      }
    } else {
      const result = proteinSequenceSchema.safeParse(data.proteinSequence)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({ ...issue, path: ['proteinSequence'] })
        }
      }
      // Species is required for protein mode (needed for reverse translation)
      if (data.species === 'none') {
        ctx.addIssue({
          path: ['species'],
          code: z.ZodIssueCode.custom,
          message:
            'Species selection is required for protein sequences (needed for codon preference during reverse translation).',
        })
      }
    }

    // Cross-field: splice position must lie strictly inside the coding
    // sequence (1 ≤ position ≤ length - 1). Only validate when we have
    // a DNA sequence (in protein mode, codingSequence is set after
    // reverse translation and may be empty at validation time).
    if (data.sequenceType === 'dna' && data.codingSequence.length > 0) {
      const max = data.codingSequence.length - 1
      if (data.spliceJunctionPosition > max) {
        ctx.addIssue({
          path: ['spliceJunctionPosition'],
          code: z.ZodIssueCode.custom,
          message: `Split position must be ≤ ${max} (sequence length − 1).`,
        })
      }
    }
  })

export type FormValues = z.infer<typeof validationSchema>

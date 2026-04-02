import { z } from 'zod'

const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA', 'UAA', 'UAG', 'UGA'])
const NUCLEOTIDE_RE = /^[ACGTUacgtu]+$/
const AMINO_ACID_RE = /^[ACDEFGHIKLMNPQRSTVWYacdefghiklmnpqrstvwy*]+$/

function findInternalStopCodons(seq: string): number[] {
  const upper = seq.toUpperCase()
  const positions: number[] = []
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
      .nonempty('Sequence is required.')
      .max(50000, 'Sequence must be 50,000 characters or fewer.'),
    inputType: z.enum(['nucleotide', 'amino_acid']),
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
    const seq = data.codingSequence

    if (data.inputType === 'amino_acid') {
      if (!AMINO_ACID_RE.test(seq)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Sequence must contain only valid amino acid characters (A, C, D, E, F, G, H, I, K, L, M, N, P, Q, R, S, T, V, W, Y).',
          path: ['codingSequence'],
        })
      }
    } else {
      if (!NUCLEOTIDE_RE.test(seq)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Sequence must contain only valid nucleotides (A, C, G, T, or U).',
          path: ['codingSequence'],
        })
        return
      }
      if (seq.length % 3 !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Sequence length must be a multiple of 3 (complete codons).',
          path: ['codingSequence'],
        })
      }
      const first3 = seq.slice(0, 3).toUpperCase()
      if (first3 !== 'ATG' && first3 !== 'AUG') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Sequence must begin with a start codon (ATG). Without it, translation cannot initiate.',
          path: ['codingSequence'],
        })
      }
      if (seq.length >= 3) {
        const last3 = seq.slice(-3).toUpperCase()
        if (!STOP_CODONS.has(last3)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Sequence must end with a stop codon (TAA, TAG, or TGA). Without it, the ribosome will read through into downstream sequence.',
            path: ['codingSequence'],
          })
        }
      }
      if (seq.length >= 6 && findInternalStopCodons(seq).length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Sequence contains premature stop codon(s) in the reading frame. This will produce a truncated protein.',
          path: ['codingSequence'],
        })
      }
    }
  })

export type FormValues = z.infer<typeof validationSchema>

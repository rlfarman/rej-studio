import { z } from 'zod'
import { designToolCopy } from '../copy'

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
  .nonempty(designToolCopy.validation.dna.required)
  .regex(/^[ACGTUacgtu]+$/, designToolCopy.validation.dna.invalidChars)
  .max(50000, designToolCopy.validation.dna.tooLong)
  .transform((v) => v.toUpperCase())
  .refine((value) => value.length % 3 === 0, {
    message: designToolCopy.validation.dna.notMultipleOfThree,
  })
  .refine(
    (value) => {
      const first3 = value.slice(0, 3).toUpperCase()
      return first3 === 'ATG' || first3 === 'AUG'
    },
    { message: designToolCopy.validation.dna.missingStart },
  )
  .refine(
    (value) => {
      if (value.length < 3) return true
      const last3 = value.slice(-3).toUpperCase()
      return STOP_CODONS.has(last3)
    },
    { message: designToolCopy.validation.dna.missingStop },
  )
  .refine(
    (value) => {
      if (value.length < 6) return true
      return findInternalStopCodons(value).length === 0
    },
    { message: designToolCopy.validation.dna.prematureStop },
  )

const proteinSequenceSchema = z
  .string()
  .nonempty(designToolCopy.validation.protein.required)
  .max(16666, designToolCopy.validation.protein.tooLong)
  .refine((v) => PROTEIN_RE.test(v), {
    message: designToolCopy.validation.protein.invalidChars,
  })
  .transform((v) => v.toUpperCase())
  .refine(
    (value) => {
      // No internal stop characters — only trailing * is allowed
      const body = value.endsWith('*') ? value.slice(0, -1) : value
      return !body.includes('*')
    },
    { message: designToolCopy.validation.protein.internalStop },
  )

export const validationSchema = z
  .object({
    sequenceType: z.enum(['dna', 'protein']),
    codingSequence: z.string(),
    proteinSequence: z.string(),
    name: z
      .string()
      .nonempty(designToolCopy.validation.name.required)
      .max(250, designToolCopy.validation.name.tooLong),
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
          message: designToolCopy.validation.protein.speciesRequired,
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
          message: designToolCopy.validation.splicer.positionTooHigh(max),
        })
      }
    }
  })

export type FormValues = z.infer<typeof validationSchema>

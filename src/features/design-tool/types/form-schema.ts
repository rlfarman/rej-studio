import { z } from 'zod'
import { designToolCopy } from '../copy'

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

export type SequenceType = 'dna' | 'protein'

const PROTEIN_RE = /^[ACDEFGHIKLMNPQRSTVWYacdefghiklmnpqrstvwy*]+$/

const dnaSequenceSchema = z
  .string()
  .nonempty(designToolCopy.validation.dna.required)
  .regex(/^[ACGTUacgtu]+$/, designToolCopy.validation.dna.invalidNucleotides)
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
    { message: designToolCopy.validation.dna.missingStartCodon },
  )
  .refine(
    (value) => {
      if (value.length < 3) return true
      const last3 = value.slice(-3).toUpperCase()
      return STOP_CODONS.has(last3)
    },
    { message: designToolCopy.validation.dna.missingStopCodon },
  )
  .refine(
    (value) => {
      if (value.length < 6) return true
      return findInternalStopCodons(value).length === 0
    },
    { message: designToolCopy.validation.dna.prematureStopCodon },
  )

const proteinSequenceSchema = z
  .string()
  .nonempty(designToolCopy.validation.protein.required)
  .max(16666, designToolCopy.validation.protein.tooLong)
  .refine((v) => PROTEIN_RE.test(v), {
    message: designToolCopy.validation.protein.invalidAminoAcids,
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
    selectedWggwSites: z.array(
      z
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
        .nullable(),
    ),
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
    spliceJunctionPositions: z.array(z.number().int().min(1)).min(1).max(2),
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
          message: designToolCopy.validation.speciesRequiredForProtein,
        })
      }
    }

    // Cross-field: splice positions must lie strictly inside the coding
    // sequence (1 ≤ position ≤ length - 1) and be sorted ascending. Only
    // validate when we have a DNA sequence (in protein mode, codingSequence
    // is set after reverse translation and may be empty at validation time).
    if (data.sequenceType === 'dna' && data.codingSequence.length > 0) {
      const max = data.codingSequence.length - 1
      data.spliceJunctionPositions.forEach((pos, i) => {
        if (pos > max) {
          ctx.addIssue({
            path: ['spliceJunctionPositions', i],
            code: z.ZodIssueCode.custom,
            message: designToolCopy.validation.spliceTooLarge(max),
          })
        }
      })
      for (let i = 1; i < data.spliceJunctionPositions.length; i++) {
        if (
          data.spliceJunctionPositions[i] <= data.spliceJunctionPositions[i - 1]
        ) {
          ctx.addIssue({
            path: ['spliceJunctionPositions', i],
            code: z.ZodIssueCode.custom,
            message: 'Splice positions must be in ascending order',
          })
        }
      }
    }
  })

export type FormValues = z.infer<typeof validationSchema>
export type SelectedWggwSite = NonNullable<
  FormValues['selectedWggwSites'][number]
>

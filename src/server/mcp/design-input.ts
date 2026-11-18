import { z } from 'zod'

import {
  validationSchema,
  type FormValues,
} from '@/features/design-tool/types/form-schema'
import { pickDefaultSplitPoint } from '@/features/design-tool/utils/default-split-point'
import {
  listWggwSites,
  pickDefaultWggwSite,
} from '@/features/design-tool/utils/default-wggw-site'
import { isSpecies, type Species } from '@/lib/bio/species'

import { mcpCopy } from './copy'

/** Reverse-translates a protein for a species, as the optimizer does. */
export type ReverseTranslate = (
  protein: string,
  species: Species,
) => Promise<{ ok: true; CDS: string } | { ok: false; message: string }>

/** The design options an agent can set. Defaults match the form's. */
export const designInput = z.object({
  name: z.string().min(1).max(250).describe(mcpCopy.submitDesign.input.name),
  sequence: z.string().min(1).describe(mcpCopy.submitDesign.input.sequence),
  sequence_type: z
    .enum(['dna', 'protein'])
    .optional()
    .describe(mcpCopy.submitDesign.input.sequenceType),
  species: z
    .enum(['none', 'human', 'mouse'])
    .optional()
    .describe(mcpCopy.submitDesign.input.species),
  split_point: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(mcpCopy.submitDesign.input.splitPoint),
  seed: z.number().int().optional().describe(mcpCopy.submitDesign.input.seed),
  remove_cryptic_splice_sites: z.boolean().optional(),
  minimize_cpgs: z.boolean().optional(),
  reduce_kmer_complexity: z.boolean().optional(),
  enforce_gc_content: z.boolean().optional(),
  five_prime_stimulatory_intron: z.boolean().optional(),
  three_prime_stimulatory_intron: z.boolean().optional(),
})

export type DesignInput = z.infer<typeof designInput>

/**
 * Turns an agent's design input into the form values the app validates.
 *
 * Protein input is reverse-translated by the optimizer first, exactly as the
 * form does before a design runs, so both routes hand the optimizer a coding
 * sequence spelled with the codons it scores against. The translation is
 * passed in, so this module stays free of the Worker's .wasm import and can
 * run anywhere (the Worker smoke test builds the same request in Node).
 */
export async function toFormValues(
  input: DesignInput,
  reverseTranslate: ReverseTranslate,
): Promise<FormValues> {
  const species = input.species ?? 'none'
  const sequenceType = input.sequence_type ?? 'dna'
  const raw = input.sequence.trim().toUpperCase()

  if (sequenceType === 'protein' && !isSpecies(species)) {
    throw new Error(
      'Protein input needs a species ("human" or "mouse"), because it is reverse-translated before optimization.',
    )
  }

  let codingSequence = raw
  if (sequenceType === 'protein' && isSpecies(species)) {
    const translated = await reverseTranslate(raw, species)
    if (!translated.ok) throw new Error(translated.message)
    codingSequence = translated.CDS
  }

  const splitPoint = input.split_point ?? pickDefaultSplitPoint(codingSequence)

  const values = {
    sequenceType,
    codingSequence,
    proteinSequence: sequenceType === 'protein' ? raw : '',
    name: input.name,
    species,
    codonOptimizeWeight: 1,
    removeCrypticSpliceSites: input.remove_cryptic_splice_sites ?? true,
    removeCrypticSpliceSitesWeight: 1,
    minimizeCpgs: input.minimize_cpgs ?? true,
    minimizeCpgsWeight: 1,
    reduceKmerComplexity: input.reduce_kmer_complexity ?? true,
    reduceKmerComplexityWeight: 1,
    enforceGcContent: input.enforce_gc_content ?? true,
    '5PrimeStimulatoryIntron': input.five_prime_stimulatory_intron ?? false,
    '3PrimeStimulatoryIntron': input.three_prime_stimulatory_intron ?? false,
    spliceJunctionPositions: [splitPoint],
    selectedWggwSites: [
      pickDefaultWggwSite(listWggwSites(codingSequence), splitPoint),
    ],
  }

  // The form's own schema has the final word, so an agent cannot run a
  // design the UI would have refused.
  return validationSchema.parse(values)
}

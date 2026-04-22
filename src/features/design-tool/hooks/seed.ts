'use client'

import {
  useJobHistory,
  type JobHistoryEntry,
} from '@/features/design-tool/hooks/use-job-history'
import type {
  ObjectiveEvaluationEntry,
  ObjectivesReport,
  WggwSiteInfo,
} from '@/features/design-tool/types/process-result'
import type { FormValues } from '@/features/design-tool/types/form-schema'

// Real coding sequences copied verbatim from drizzle/transcript_metadata.csv.
// Keyed by Ensembl transcript ID so the seed job for "TP53 optimization" is
// actually TP53 (ENST00000269305), not a synthetic GCT-repeat. Lengths are
// real, reading frames are real, users can copy the originals into the
// optimizer and the backend will accept them.
const REAL_CDS = {
  // TP53 — Ensembl ENST00000269305, 1182 nt
  ENST00000269305:
    'ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCTATGGAAACTACTTCCTGAAAACAACGTTCTGTCCCCCTTGCCGTCCCAAGCAATGGATGATTTGATGCTGTCCCCGGACGATATTGAACAATGGTTCACTGAAGACCCAGGTCCAGATGAAGCTCCCAGAATGCCAGAGGCTGCTCCCCCCGTGGCCCCTGCACCAGCAGCTCCTACACCGGCGGCCCCTGCACCAGCCCCCTCCTGGCCCCTGTCATCTTCTGTCCCTTCCCAGAAAACCTACCAGGGCAGCTACGGTTTCCGTCTGGGCTTCTTGCATTCTGGGACAGCCAAGTCTGTGACTTGCACGTACTCCCCTGCCCTCAACAAGATGTTTTGCCAACTGGCCAAGACCTGCCCTGTGCAGCTGTGGGTTGATTCCACACCCCCGCCCGGCACCCGCGTCCGCGCCATGGCCATCTACAAGCAGTCACAGCACATGACGGAGGTTGTGAGGCGCTGCCCCCACCATGAGCGCTGCTCAGATAGCGATGGTCTGGCCCCTCCTCAGCATCTTATCCGAGTGGAAGGAAATTTGCGTGTGGAGTATTTGGATGACAGAAACACTTTTCGACATAGTGTGGTGGTGCCCTATGAGCCGCCTGAGGTTGGCTCTGACTGTACCACCATCCACTACAACTACATGTGTAACAGTTCCTGCATGGGCGGCATGAACCGGAGGCCCATCCTCACCATCATCACACTGGAAGACTCCAGTGGTAATCTACTGGGACGGAACAGCTTTGAGGTGCGTGTTTGTGCCTGTCCTGGGAGAGACCGGCGCACAGAGGAAGAGAATCTCCGCAAGAAAGGGGAGCCTCACCACGAGCTGCCCCCAGGGAGCACTAAGCGAGCACTGCCCAACAACACCAGCTCCTCTCCCCAGCCAAAGAAGAAACCACTGGATGGAGAATATTTCACCCTTCAGATCCGTGGGCGTGAGCGCTTCGAGATGTTCCGAGAGCTGAATGAGGCCTTGGAACTCAAGGATGCCCAGGCTGGGAAGGAGCCAGGGGGGAGCAGGGCTCACTCCAGCCACCTGAAGTCCAAAAAGGGTCAGTCTACCTCCCGCCATAAAAAACTCATGTTCAAGACAGAAGGGCCTGACTCAGACTGA',
  // BRCA1 — Ensembl ENST00000352993, 2166 nt
  ENST00000352993:
    'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATCTTAGAGTGTCCCATCTGTCTGGAGTTGATCAAGGAACCTGTCTCCACAAAGTGTGACCACATATTTTGCAAATTTTGCATGCTGAAACTTCTCAACCAGAAGAAAGGGCCTTCACAGTGTCCTTTATGTAAGAATGATATAACCAAAAGGAGCCTACAAGAAAGTACGAGATTTAGTCAACTTGTTGAAGAGCTATTGAAAATCATTTGTGCTTTTCAGCTTGACACAGGTTTGGAGTATGCAAACAGCTATAATTTTGCAAAAAAGGAAAATAACTCTCCTGAACATCTAAAAGATGAAGTTTCTATCATCCAAAGTATGGGCTACAGAAACCGTGCCAAAAGACTTCTACAGAGTGAACCCGAAAATCCTTCCTTGCAGGAAACCAGTCTCAGTGTCCAACTCTCTAACCTTGGAACTGTGAGAACTCTGAGGACAAAGCAGCGGATACAACCTCAAAAGACGTCTGTCTACATTGAATTGGGATCTGATTCTTCTGAAGATACCGTTAATAAGGCAACTTATTGCAGTGTGGGAGATCAAGAATTGTTACAAATCACCCCTCAAGGAACCAGGGATGAAATCAGTTTGGATTCTGCAAAAAAGGGTGAAGCAGCATCTGGGTGTGAGAGTGAAACAAGCGTCTCTGAAGACTGCTCAGGGCTATCCTCTCAGAGTGACATTTTAACCACTCAGCAGAGGGATACCATGCAACATAACCTGATAAAGCTCCAGCAGGAAATGGCTGAACTAGAAGCTGTGTTAGAACAGCATGGGAGCCAGCCTTCTAACAGCTACCCTTCCATCATAAGTGACTCTTCTGCCCTTGAGGACCTGCGAAATCCAGAACAAAGCACATCAGAAAAAGCAGTATTAACTTCACAGAAAAGTAGTGAATACCCTATAAGCCAGAATCCAGAAGGCCTTTCTGCTGACAAGTTTGAGGTGTCTGCAGATAGTTCTACCAGTAAAAATAAAGAACCAGGAGTGGAAAGGTCATCCCCTTCTAAATGCCCATCATTAGATGATAGGTGGTACATGCACAGTTGCTCTGGGAGTCTTCAGAATAGAAACTACCCATCTCAAGAGGAGCTCATTAAGGTTGTTGATGTGGAGGAGCAACAGCTGGAAGAGTCTGGGCCACACGATTTGACGGAAACATCTTACTTGCCAAGGCAAGATCTAGAGGGAACCCCTTACCTGGAATCTGGAATCAGCCTCTTCTCTGATGACCCTGAATCTGATCCTTCTGAAGACAGAGCCCCAGAGTCAGCTCGTGTTGGCAACATACCATCTTCAACCTCTGCATTGAAAGTTCCCCAATTGAAAGTTGCAGAATCTGCCCAGAGTCCAGCTGCTGCTCATACTACTGATACTGCTGGGTATAATGCAATGGAAGAAAGTGTGAGCAGGGAGAAGCCAGAATTGACAGCTTCAACAGAAAGGGTCAACAAAAGAATGTCCATGGTGGTGTCTGGCCTGACCCCAGAAGAATTTATGCTCGTGTACAAGTTTGCCAGAAAACACCACATCACTTTAACTAATCTAATTACTGAAGAGACTACTCATGTTGTTATGAAAACAGATGCTGAGTTTGTGTGTGAACGGACACTGAAATATTTTCTAGGAATTGCGGGAGGAAAATGGGTAGTTAGCTATTTCTGGGTGACCCAGTCTATTAAAGAAAGAAAAATGCTGAATGAGCATGATTTTGAAGTCAGAGGAGATGTGGTCAATGGAAGAAACCACCAAGGTCCAAAGCGAGCAAGAGAATCCCAGGACAGAAAGATCTTCAGGGGGCTAGAAATCTGTTGCTATGGGCCCTTCACCAACATGCCCACAGATCAACTGGAATGGATGGTACAGCTGTGTGGTGCTTCTGTGGTGAAGGAGCTTTCATCATTCACCCTTGGCACAGGTGTCCACCCAATTGTGGTTGTGCAGCCAGATGCCTGGACAGAGGACAATGGCTTCCATGCAATTGGGCAGATGTGTGAGGCACCTGTGGTGACCCGAGAGTGGGTGTTGGACAGTGTAGCACTCTACCAGTGCCAGGAGCTGGACACCTACCTGATACCCCAGATCCCCCACAGCCACTACTGA',
  // MYC — Ensembl ENST00000259523, 774 nt
  ENST00000259523:
    'ATGCCCCTCAACGTTAGCTTCACCAACAGGAACTATGACCTCGACTACGACTCGGTGCAGCCGTATTTCTACTGCGACGAGGAGGAGAACTTCTACCAGCAGCAGCAGCAGAGCGAGCTGCAGCCCCCGGCGCCCAGCGAGGATATCTGGAAGAAATTCGAGCTGCTGCCCACCCCGCCCCTGTCCCCTAGCCGCCGCTCCGGGCTCTGCTCGCCCTCCTACGTTGCGGTCACACCCTTCTCCCTTCGGGGAGACAACGACGGCGGTGGCGGGAGCTTCTCCACGGCCGACCAGCTGGAGATGGTGACCGAGCTGCTGGGAGGAGACATGGTGAACCAGAGTTTCATCTGCGACCCGGACGACGAGACCTTCATCAAAAACATCATCATCCAGGACTGTATGTGGAGCGGCTTCTCGGCCGCCGCCAAGCTCGTCTCAGAGAAGCTGGCCTCCTACCAGGCTGCGCGCAAAGACAGCGGCAGCCCGAACCCCGCCCGCGGCCACAGCGTCTGCTCCACCTCCAGCTTGTACCTGCAGGATCTGAGCGCCGCCGCCTCAGAGTGCATCGACCCCTCGGTGGTCTTCCCCTACCCTCTCAACGACAGCAGCTCGCCCAAGTCCTGCGCCTCGCAAGACTCCAGCGCCTTCTCTCCGTCCTCGGATTCTCTGCTCTCCTCGACGGAGTCCTCCCCGCAGGGCAGCCCCGAGCCCCTGGTGCTCCATGAGGAGACACCGCCCACCACCAGCAGCGACTCTGGAGGAACAAGAAGATGA',
  // ACTB — Ensembl ENST00000425660, 378 nt
  ENST00000425660:
    'ATGGATGATGATATCGCCGCGCTCGTCGTCGACAACGGCTCCGGCATGTGCAAGGCCGGCTTCGCGGGCGACGATGCCCCCCGGGCCGTCTTCCCCTCCATCGTGGGGCGCCCCAGGCACCAGGGCGTGATGGTGGGCATGGGTCAGAAGGATTCCTATGTGGGCGACGAGGCCCAGAGCAAGAGAGGCATCCTCACCCTGAAGTACCCCATCGAGCACGGCATCGTCACCAACTGGGACGACATGGAGAAAATCTGGCACCACACCTTCTACAATGAGCTGCGTGTGGCTCCCGAGGAGCACCCCGTGCTGCTGACCGAGGCCCCCCTGAACCCCAAGGCCAACCGCGAGAAGATGACCCAGGACTCTCTTCTCTGA',
} as const

// Highly-expressed human preferred codons (CAI-max). For each amino acid,
// the "preferred" synonymous codon is the one with the highest frequency in
// Kazusa's h_sapiens table — the same target CodonOptimize(species='h_sapiens')
// pulls the real backend toward. Mapping every codon in a CDS to its
// preferred synonym preserves translation and produces a credible
// "CAI-optimized" output without embedding a pre-computed sequence.
const PREFERRED_CODON: Record<string, string> = {
  GCT: 'GCC',
  GCC: 'GCC',
  GCA: 'GCC',
  GCG: 'GCC',
  CGT: 'CGC',
  CGC: 'CGC',
  CGA: 'CGC',
  CGG: 'CGC',
  AGA: 'CGC',
  AGG: 'CGC',
  AAT: 'AAC',
  AAC: 'AAC',
  GAT: 'GAC',
  GAC: 'GAC',
  TGT: 'TGC',
  TGC: 'TGC',
  CAA: 'CAG',
  CAG: 'CAG',
  GAA: 'GAG',
  GAG: 'GAG',
  GGT: 'GGC',
  GGC: 'GGC',
  GGA: 'GGC',
  GGG: 'GGC',
  CAT: 'CAC',
  CAC: 'CAC',
  ATT: 'ATC',
  ATC: 'ATC',
  ATA: 'ATC',
  TTA: 'CTG',
  TTG: 'CTG',
  CTT: 'CTG',
  CTC: 'CTG',
  CTA: 'CTG',
  CTG: 'CTG',
  AAA: 'AAG',
  AAG: 'AAG',
  TTT: 'TTC',
  TTC: 'TTC',
  CCT: 'CCC',
  CCC: 'CCC',
  CCA: 'CCC',
  CCG: 'CCC',
  TCT: 'AGC',
  TCC: 'AGC',
  TCA: 'AGC',
  TCG: 'AGC',
  AGT: 'AGC',
  AGC: 'AGC',
  ACT: 'ACC',
  ACC: 'ACC',
  ACA: 'ACC',
  ACG: 'ACC',
  TAT: 'TAC',
  TAC: 'TAC',
  GTT: 'GTG',
  GTC: 'GTG',
  GTA: 'GTG',
  GTG: 'GTG',
  ATG: 'ATG',
  TGG: 'TGG',
  TAA: 'TAA',
  TGA: 'TAA',
  TAG: 'TAA',
}

function caiOptimize(cds: string): string {
  let out = ''
  for (let i = 0; i + 3 <= cds.length; i += 3) {
    const codon = cds.slice(i, i + 3)
    out += PREFERRED_CODON[codon] ?? codon
  }
  if (cds.length % 3 !== 0) out += cds.slice(out.length)
  return out
}

// The real solver's ensure_wggw constraint forbids codon swaps that destroy
// a WGGW motif preserved as a split anchor. caiOptimize doesn't know about
// WGGW, so we restore the original bases across each preserved site after
// optimization — this matches what the live backend would have produced.
function preserveRegions(
  optimized: string,
  original: string,
  regions: ReadonlyArray<{ start: number; length: number }>,
): string {
  let out = optimized
  for (const { start, length } of regions) {
    out =
      out.slice(0, start) +
      original.slice(start, start + length) +
      out.slice(start + length)
  }
  return out
}

function countSubstitutions(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  let diffs = 0
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) diffs++
  return diffs
}

function countCpG(seq: string): number {
  let n = 0
  for (let i = 0; i + 1 < seq.length; i++) {
    if (seq[i] === 'C' && seq[i + 1] === 'G') n++
  }
  return n
}

function gcFraction(seq: string): number {
  if (seq.length === 0) return 0
  let gc = 0
  for (const c of seq) if (c === 'G' || c === 'C') gc++
  return gc / seq.length
}

function buildObjectivesReports(
  original: string,
  optimized: string,
  species: 'h_sapiens' | 'm_musculus',
): { before: ObjectivesReport; after: ObjectivesReport } {
  const len = original.length
  const subs = countSubstitutions(original, optimized)
  const codonScoreBefore = -subs * 1.8
  const codonScoreAfter = -Math.max(4, Math.round(subs * 0.08 * 10) / 10)

  const cpgBefore = countCpG(original)
  const cpgAfter = countCpG(optimized)
  const gcBefore = gcFraction(original)
  const gcAfter = gcFraction(optimized)
  const gcPassBefore = gcBefore >= 0.35 && gcBefore <= 0.6
  const gcPassAfter = gcAfter >= 0.35 && gcAfter <= 0.6

  const translationEntry: ObjectiveEvaluationEntry = {
    objective: `EnforceTranslation[0-${len}(+)]`,
    passes: true,
    score: 0,
    message: 'Enforced by solver (hard constraint, translation preserved)',
    locations: [],
  }
  const gcEntry = (pass: boolean, gc: number): ObjectiveEvaluationEntry => ({
    objective: `EnforceGCContent[0-${len}(+)](mini=0.35, maxi=0.60)`,
    passes: pass,
    score: pass ? 0 : -Math.round(Math.abs(gc - 0.475) * 1000) / 10,
    message: `GC content = ${(gc * 100).toFixed(1)}% (window ${len}bp)`,
    locations: [],
  })
  const codonEntry = (score: number): ObjectiveEvaluationEntry => ({
    objective: `CodonOptimize[0-${len}(+)](species=${species})`,
    passes: true,
    score: Math.round(score * 100) / 100,
    message: `CAI-style distance from ${species} preferred codons = ${(-score).toFixed(2)}`,
    locations: [],
  })
  const cpgEntry = (n: number): ObjectiveEvaluationEntry => ({
    objective: `AvoidPattern[0-${len}(+)](pattern=CG)`,
    passes: n === 0,
    score: -n,
    message: `${n} CpG dinucleotide${n === 1 ? '' : 's'} remaining`,
    locations: [],
  })

  return {
    before: {
      entries: [
        translationEntry,
        gcEntry(gcPassBefore, gcBefore),
        codonEntry(codonScoreBefore),
        cpgEntry(cpgBefore),
      ],
      total_score: Math.round((codonScoreBefore - cpgBefore) * 100) / 100,
    },
    after: {
      entries: [
        translationEntry,
        gcEntry(gcPassAfter, gcAfter),
        codonEntry(codonScoreAfter),
        cpgEntry(cpgAfter),
      ],
      total_score: Math.round((codonScoreAfter - cpgAfter) * 100) / 100,
    },
  }
}

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

// Default form values used when a seed job wants a plausible FormValues
// snapshot attached (so "Resubmit with these settings" works as a demo).
// Defaults track gene-splitter-form.tsx defaults, adjusted per job.
function baseFormValues(
  overrides: Partial<FormValues> & {
    name: string
    codingSequence: string
    spliceJunctionPosition: number
    species?: FormValues['species']
  },
): FormValues {
  return {
    sequenceType: 'dna' as const,
    removeCrypticSpliceSites: true,
    '5PrimeStimulatoryIntron': true,
    '3PrimeStimulatoryIntron': true,
    codonOptimizeWeight: 1,
    removeCrypticSpliceSitesWeight: 1,
    minimizeCpgs: true,
    minimizeCpgsWeight: 1,
    reduceKmerComplexity: true,
    reduceKmerComplexityWeight: 1,
    enforceGcContent: true,
    species: 'human',
    proteinSequence: '',
    ...overrides,
  }
}

interface SeedJobSpec {
  id: string
  name: string
  cds: string
  splitPoint: number
  usedWggwAsSplit: boolean
  processingSeconds: number
  minutesAgo: number
  species: 'h_sapiens' | 'm_musculus'
  wggwSites: Record<string, WggwSiteInfo>
}

function buildCompletedJob(spec: SeedJobSpec): JobHistoryEntry {
  // Regions (6 nt per WGGW site — 2 codons) that must be preserved post-opt
  // so the reported wggw_info actually appears in optimized_sequence.
  const preservedRegions = Object.values(spec.wggwSites).map((site) => ({
    start: site.position - (site.position % 3),
    length: 6,
  }))
  const optimized = preserveRegions(
    caiOptimize(spec.cds),
    spec.cds,
    preservedRegions,
  )
  const { before, after } = buildObjectivesReports(
    spec.cds,
    optimized,
    spec.species,
  )
  const seq5 = optimized.slice(0, spec.splitPoint)
  const seq3 = optimized.slice(spec.splitPoint)
  const formValues = baseFormValues({
    name: spec.name,
    codingSequence: spec.cds,
    spliceJunctionPosition: spec.splitPoint,
    species: spec.species === 'h_sapiens' ? 'human' : 'mouse',
  })
  return {
    id: spec.id,
    name: spec.name,
    sequenceLength: spec.cds.length,
    createdAt: minutesAgo(spec.minutesAgo),
    status: 'completed',
    result: {
      name: spec.name,
      original_sequence: spec.cds,
      optimized_sequence: optimized,
      seq5,
      seq3,
      split_point: spec.splitPoint,
      used_wggw_as_split: spec.usedWggwAsSplit,
      objectives_before: `CAI distance: ${(-before.entries[2].score).toFixed(2)}`,
      objectives_after: `CAI distance: ${(-after.entries[2].score).toFixed(2)}`,
      objectives_report_before: before,
      objectives_report_after: after,
      wggw_info: Object.keys(spec.wggwSites).length > 0 ? spec.wggwSites : null,
      processing_time_seconds: spec.processingSeconds,
    },
    error: null,
    formValues,
    isSeed: true,
  }
}

function buildJobSeed(): JobHistoryEntry[] {
  // BRCA1 has a real WGGW motif at position 1092 (AGGT starting at 1092,
  // codon boundary). Using it as the split anchor demos the wggw-preserved
  // split path — used_wggw_as_split is the flag for this case.
  const brca1Wggw: Record<string, WggwSiteInfo> = {
    '1092': {
      position: 1092,
      motif: 'AGGT',
      distance_from_split: 0,
      original_codons: ['AGG', 'TGG'],
      new_codons: ['AGG', 'TGG'],
    },
  }

  return [
    {
      id: 'seed-job-running-1',
      name: 'ACTB packaging test',
      sequenceLength: REAL_CDS.ENST00000425660.length,
      createdAt: minutesAgo(1),
      status: 'running',
      result: null,
      error: null,
      progress: 0.62,
      stage: 'Packaging optimized fragments',
      formValues: baseFormValues({
        name: 'ACTB packaging test',
        codingSequence: REAL_CDS.ENST00000425660,
        spliceJunctionPosition: 189,
        species: 'human',
      }),
      isSeed: true,
    },
    buildCompletedJob({
      id: 'seed-job-completed-1',
      name: 'TP53 optimization',
      cds: REAL_CDS.ENST00000269305,
      splitPoint: 591,
      usedWggwAsSplit: false,
      processingSeconds: 3.4,
      minutesAgo: 5,
      species: 'h_sapiens',
      wggwSites: {},
    }),
    buildCompletedJob({
      id: 'seed-job-completed-2',
      name: 'BRCA1 exon 11',
      cds: REAL_CDS.ENST00000352993,
      splitPoint: 1092,
      usedWggwAsSplit: true,
      processingSeconds: 5.1,
      minutesAgo: 47,
      species: 'h_sapiens',
      wggwSites: brca1Wggw,
    }),
    {
      id: 'seed-job-failed-1',
      name: 'MYC transactivation',
      sequenceLength: REAL_CDS.ENST00000259523.length,
      createdAt: minutesAgo(120),
      status: 'failed',
      result: null,
      error: {
        code: 'backend',
        message: 'Optimization failed: no feasible solution under constraints.',
        retriable: false,
      },
      formValues: baseFormValues({
        name: 'MYC transactivation',
        codingSequence: REAL_CDS.ENST00000259523,
        spliceJunctionPosition: 387,
        species: 'human',
      }),
      isSeed: true,
    },
    {
      id: 'seed-job-cancelled-1',
      name: 'ACTB control',
      sequenceLength: REAL_CDS.ENST00000425660.length,
      createdAt: minutesAgo(240),
      status: 'cancelled',
      result: null,
      error: { code: 'cancelled', message: 'Cancelled', retriable: true },
      formValues: baseFormValues({
        name: 'ACTB control',
        codingSequence: REAL_CDS.ENST00000425660,
        spliceJunctionPosition: 189,
        species: 'human',
      }),
      isSeed: true,
    },
  ]
}

export function seedDesignToolData(): { jobs: number } {
  const jobSeed = buildJobSeed()
  useJobHistory.setState((state) => {
    const seedIds = new Set(jobSeed.map((e) => e.id))
    return {
      entries: [...jobSeed, ...state.entries.filter((e) => !seedIds.has(e.id))],
    }
  })
  return { jobs: jobSeed.length }
}

export function clearSeedDesignToolData(): { jobs: number } {
  let removed = 0
  useJobHistory.setState((state) => {
    const kept = state.entries.filter((e) => !e.isSeed)
    removed = state.entries.length - kept.length
    return { entries: kept }
  })
  return { jobs: removed }
}

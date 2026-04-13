import { parseFasta, cleanSequence } from '@/lib/bio/fasta'
import { parseCsv } from '@/lib/bio/csv'

const MAX_BATCH_SIZE = 50
const MAX_DNA_LENGTH = 50_000
const MAX_PROTEIN_LENGTH = 16_666
const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA', 'UAA', 'UAG', 'UGA'])

export interface BatchEntry {
  name: string
  rawSequence: string
  cleanedSequence: string
  sequenceType: 'dna' | 'protein'
  validationErrors: string[]
}

export interface BatchParseResult {
  entries: BatchEntry[]
  fileError: string | null
}

function detectSequenceType(seq: string): 'dna' | 'protein' {
  const upper = seq.toUpperCase()
  // If >90% of characters are ACGTU, it's likely DNA
  const dnaChars = upper.replace(/[^ACGTU]/g, '').length
  return dnaChars / upper.length > 0.9 ? 'dna' : 'protein'
}

function validateDna(seq: string): string[] {
  const errors: string[] = []
  if (!/^[ACGTUacgtu]+$/.test(seq)) {
    errors.push('Contains invalid nucleotide characters.')
    return errors
  }
  if (seq.length > MAX_DNA_LENGTH)
    errors.push(`Exceeds ${MAX_DNA_LENGTH.toLocaleString()} bp limit.`)
  if (seq.length % 3 !== 0) errors.push('Length is not a multiple of 3.')
  const first3 = seq.slice(0, 3).toUpperCase()
  if (first3 !== 'ATG' && first3 !== 'AUG')
    errors.push('Missing start codon (ATG).')
  if (seq.length >= 3 && !STOP_CODONS.has(seq.slice(-3).toUpperCase()))
    errors.push('Missing stop codon.')
  // Internal stop codons
  const upper = seq.toUpperCase()
  for (let i = 0; i < upper.length - 3; i += 3) {
    if (STOP_CODONS.has(upper.slice(i, i + 3))) {
      errors.push('Contains internal stop codon(s).')
      break
    }
  }
  return errors
}

function validateProtein(seq: string): string[] {
  const errors: string[] = []
  if (!/^[ACDEFGHIKLMNPQRSTVWYacdefghiklmnpqrstvwy*]+$/.test(seq)) {
    errors.push('Contains invalid amino acid characters.')
    return errors
  }
  if (seq.length > MAX_PROTEIN_LENGTH)
    errors.push(`Exceeds ${MAX_PROTEIN_LENGTH.toLocaleString()} residue limit.`)
  const body = seq.endsWith('*') ? seq.slice(0, -1) : seq
  if (body.includes('*')) errors.push('Contains internal stop character(s).')
  return errors
}

export function parseBatchFile(
  text: string,
  fileName: string,
): BatchParseResult {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''

  let rawEntries: { name: string; sequence: string }[]

  if (['fasta', 'fa', 'fna', 'faa'].includes(ext)) {
    rawEntries = parseFasta(text).map((e) => ({
      name: e.header || `Sequence ${rawEntries?.length ?? 0 + 1}`,
      sequence: e.sequence,
    }))
    // Fix: parseFasta entries might reference rawEntries before it's assigned
    rawEntries = parseFasta(text).map((e, i) => ({
      name: e.header || `Sequence ${i + 1}`,
      sequence: e.sequence,
    }))
  } else if (ext === 'csv') {
    rawEntries = parseCsv(text)
  } else {
    // Try to auto-detect: if it starts with '>', treat as FASTA, else CSV
    if (text.trimStart().startsWith('>')) {
      rawEntries = parseFasta(text).map((e, i) => ({
        name: e.header || `Sequence ${i + 1}`,
        sequence: e.sequence,
      }))
    } else {
      rawEntries = parseCsv(text)
    }
  }

  if (rawEntries.length === 0) {
    return { entries: [], fileError: 'No valid sequences found in file.' }
  }

  if (rawEntries.length > MAX_BATCH_SIZE) {
    return {
      entries: [],
      fileError: `File contains ${rawEntries.length} sequences (max ${MAX_BATCH_SIZE}).`,
    }
  }

  const entries: BatchEntry[] = rawEntries
    .filter((e) => e.sequence.length > 0)
    .map((raw) => {
      const seqType = detectSequenceType(raw.sequence)
      const mode = seqType === 'dna' ? 'dna' : 'protein'
      const { cleaned } = cleanSequence(raw.sequence, mode)
      const errors =
        seqType === 'dna' ? validateDna(cleaned) : validateProtein(cleaned)

      return {
        name: raw.name.slice(0, 250),
        rawSequence: raw.sequence,
        cleanedSequence: cleaned,
        sequenceType: seqType,
        validationErrors: cleaned.length === 0 ? ['Empty sequence.'] : errors,
      }
    })

  return { entries, fileError: null }
}

export { MAX_BATCH_SIZE }

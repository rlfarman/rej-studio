/** Input sequence type: coding DNA (or RNA) vs. amino-acid sequence. */
export type SequenceType = 'dna' | 'protein'

// Letters that appear ONLY in the amino-acid alphabet (never in DNA/RNA).
// Presence of any of these unambiguously identifies a protein sequence.
// The overlapping letters (A, C, G, T) remain ambiguous and are classified
// as DNA by default, matching the backend's auto-detection logic.
const PROTEIN_ONLY_LETTERS = /[DEFHIKLMNPQRSVWY*]/i

/** Matches a sequence made entirely of DNA/RNA nucleotides (ACGTU). */
export const DNA_ALPHABET_REGEX = /^[ACGTUacgtu]+$/

/** Matches a sequence made entirely of standard amino acids + stop codon. */
export const PROTEIN_ALPHABET_REGEX =
  /^[ACDEFGHIKLMNPQRSTVWYacdefghiklmnpqrstvwy*]+$/

/** Matches any character from the union of DNA/RNA + protein alphabets. */
export const BIO_ALPHABET_REGEX =
  /^[ACDEFGHIKLMNPQRSTUVWYacdefghiklmnpqrstuvwy*]+$/

/**
 * Auto-detect whether a sequence is DNA/RNA or a protein. A sequence that
 * contains any amino-acid-only letter is protein; everything else is DNA.
 */
export function detectSequenceType(seq: string): SequenceType {
  if (PROTEIN_ONLY_LETTERS.test(seq)) return 'protein'
  return 'dna'
}

/**
 * Length of DNA that the backend will optimize. For DNA input that's the
 * sequence itself; for protein input, the reverse-translation produces 3 bp
 * per residue.
 */
export function effectiveDnaLength(
  seq: string,
  type: SequenceType = detectSequenceType(seq),
): number {
  return type === 'protein' ? seq.length * 3 : seq.length
}

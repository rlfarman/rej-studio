/** Parse a FASTA-formatted string into header/sequence pairs. */
export function parseFasta(
  text: string,
): { header: string; sequence: string }[] {
  const results: { header: string; sequence: string }[] = []
  let currentHeader = ''
  let currentSeq = ''

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('>')) {
      if (currentHeader || currentSeq) {
        results.push({ header: currentHeader, sequence: currentSeq })
      }
      currentHeader = trimmed.slice(1).trim()
      currentSeq = ''
    } else {
      currentSeq += trimmed
    }
  }

  if (currentHeader || currentSeq) {
    results.push({ header: currentHeader, sequence: currentSeq })
  }

  return results
}

/** Strip whitespace, line numbers, FASTA headers, and non-nucleotide characters. */
export function cleanSequence(text: string): {
  cleaned: string
  removedChars: number
  removedHeaders: number
} {
  let removedHeaders = 0
  const lines = text.split(/\r?\n/)
  const sequenceLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('>')) {
      removedHeaders++
      continue
    }
    // Strip line numbers (e.g., "1 ATGATG" or "001 ATGATG")
    const withoutLineNumbers = trimmed.replace(/^\d+\s+/, '')
    sequenceLines.push(withoutLineNumbers)
  }

  const joined = sequenceLines.join('')
  // Remove all non-nucleotide characters (keep only ACGTU)
  const cleaned = joined.replace(/[^ACGTUacgtu]/g, '').toUpperCase()
  const removedChars = joined.length - cleaned.length

  return { cleaned, removedChars, removedHeaders }
}

/** Format a sequence as FASTA. */
export function formatFasta(
  name: string,
  sequence: string,
  lineWidth = 80,
): string {
  const header = `>${name}`
  const lines = [header]
  for (let i = 0; i < sequence.length; i += lineWidth) {
    lines.push(sequence.slice(i, i + lineWidth))
  }
  return lines.join('\n')
}

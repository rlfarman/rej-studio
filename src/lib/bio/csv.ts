export interface CsvEntry {
  name: string
  sequence: string
}

/**
 * Parse a two-column CSV (name, sequence) into entries.
 * Detects and skips a header row if the first cell looks like "name" or "header".
 */
export function parseCsv(text: string): CsvEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []

  let start = 0
  const firstCells = lines[0].split(',').map((c) => c.trim().toLowerCase())
  if (
    firstCells.length >= 2 &&
    ['name', 'header', 'id', 'label'].includes(firstCells[0]) &&
    ['sequence', 'seq', 'cds', 'protein'].includes(firstCells[1])
  ) {
    start = 1
  }

  const results: CsvEntry[] = []
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length < 2) continue
    const name = parts[0].trim().replace(/^["']|["']$/g, '')
    const sequence = parts
      .slice(1)
      .join(',')
      .trim()
      .replace(/^["']|["']$/g, '')
    if (name && sequence) {
      results.push({ name, sequence })
    }
  }

  return results
}

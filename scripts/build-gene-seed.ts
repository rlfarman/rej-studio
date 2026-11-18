/**
 * Turn the source transcript_metadata.csv into the JSONL seed that
 * `pnpm corpus:build` reads:
 *
 *   - genes.jsonl     one gene per line
 *   - isoforms.jsonl  one isoform per line
 *
 * Gene names are recased on the way through (see recaseGeneName): the CSV
 * title-cases them, mangling the acronyms and symbols inside.
 *
 *   pnpm data:genes                                   # data/transcript_metadata.csv → data/*.jsonl
 *   pnpm data:genes --csv path/to.csv --out dir       # other locations
 *   pnpm data:genes --recase-names data/sample-genes.jsonl   # fix names in a genes JSONL, in place
 *
 * Ported from scripts/build-db.py, whose output it matches byte for byte
 * (each line written as Python's json.dumps wrote it).
 */
import { createWriteStream, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { once } from 'node:events'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { column, readCsvDicts } from './lib/csv'
import {
  pyInt,
  pyJsonDumps,
  pyReadText,
  pySplit,
  pyStrip,
} from './lib/python-compat'

interface SeedGene {
  id: string
  symbol: string
  name: string
  species: string
  alternateSymbols: string
}

const deriveSpecies = (transcriptId: string) =>
  transcriptId.startsWith('ENSMUST') ? 'mouse' : 'human'

/** Pipe-delimited with sentinels: ["Abca1","Cerp"] -> "|Abca1|Cerp|". */
function serializeAlternateSymbols(symbols: string[]): string {
  return symbols.length ? `|${symbols.join('|')}|` : ''
}

// --- Gene name casing --------------------------------------------------------
//
// The source CSV title-cases gene names ("Brca1 Dna Repair Associated"), which
// mangles the acronyms and gene symbols inside them. HGNC and MGI write names
// in lower case apart from those, so rebuild that: lower-case each word unless
// it is a known acronym, a gene symbol, an alphanumeric designation ("1A"), a
// Roman numeral, or a proper noun, then capitalize the first letter for
// display. A heuristic: it fixes the common cases and leaves rare ones
// readable, never worse than the title case it replaces.

const byLowerCase = (words: string[]) =>
  new Map(words.map((word) => [word.toLowerCase(), word]))

// Lower-case form → canonical spelling.
const NAME_ACRONYMS = byLowerCase(
  'DNA RNA mRNA tRNA rRNA snRNA snoRNA miRNA lncRNA cDNA ATP ADP AMP cAMP GTP GDP GMP cGMP UDP NAD NADH NADP NADPH FAD CoA ATPase GTPase NTPase bHLH bZIP HMG KRAB BTB POZ PDZ SH2 SH3 WD LIM SET RecQ NFKB MHC HLA TNF EGF FGF IGF PDGF VEGF TGF BMP NF ER ABC ARF HECT SUMO UBX JAK STAT MAP MAPK CDC ITR UTR ORF'.split(
    ' ',
  ),
)

const PROPER_NOUNS = byLowerCase(
  'Fanconi Wilms Kruppel Wnt Golgi Willebrand Hippel Lindau Kirsten Harvey Moloney Abelson Wiskott Aldrich Bloom Werner Alzheimer Parkinson Usher Bardet Biedl Cockayne Marfan Noonan Duchenne Charcot Nijmegen Ewing Epstein Barr Rous Fas'.split(
    ' ',
  ),
)

const ROMAN_NUMERALS = new Set(
  'ii iii iv vi vii viii ix xi xii xiii xiv xv xvi xvii xviii xix xx'.split(
    ' ',
  ),
)

// A single letter after one of these is a designation ("group A", "type I").
const LETTER_DESIGNATORS = new Set(
  'type class group complex family subfamily member subunit chain polypeptide factor domain isoform variant form site protein antigen locus region'.split(
    ' ',
  ),
)

// English words that are also gene symbols; leave them lower case.
const ENGLISH_WORDS = new Set(
  'a an and as at by for in of on or the to via with like not no light large small long short rich low high early late cell clock white golden type family member protein factor'.split(
    ' ',
  ),
)

// Letters then digits, optionally more letters/digits: Brca1, Nfe2, Sox9.
const SYMBOL_SHAPED = /^[a-z]{2,}\d+[a-z0-9]*$/
// Digits then a letter suffix: the "1A" in "kinase inhibitor 1A".
const NUMBER_SUFFIX = /^\d+[a-z]\d*$/
// One letter then digits: "annexin A1", "complement C3", "H2A". Not "p":
// protein names like p53 and p21 are written lower case.
const LETTER_NUMBER = /^[a-oq-z]\d+[a-z0-9]*$/
// Phrases a per-word pass can't see. The lookarounds are Python's Unicode
// `\b` (a word character is a letter, a number or `_`), which JavaScript's
// ASCII-only `\b` is not.
const PHRASE_FIXES: [RegExp, string][] = [
  [/(?<![\p{L}\p{N}_])g protein(?![\p{L}\p{N}_])/gu, 'G protein'],
]
const WORD_PARTS = /([A-Za-z0-9]+)/

/** Recase one alphanumeric run, given the word before it. */
function recaseWord(
  word: string,
  prevWord: string,
  isLast: boolean,
  symbols: Set<string>,
): string {
  const lower = word.toLowerCase()
  const acronym = NAME_ACRONYMS.get(lower) ?? PROPER_NOUNS.get(lower)
  if (acronym) return acronym
  if (ROMAN_NUMERALS.has(lower)) return lower.toUpperCase()
  if (/^[a-z]$/.test(lower) && LETTER_DESIGNATORS.has(prevWord)) {
    return lower.toUpperCase()
  }
  if ((lower === 'i' || lower === 'v' || lower === 'x') && isLast) {
    return lower.toUpperCase()
  }
  if (NUMBER_SUFFIX.test(lower) || LETTER_NUMBER.test(lower)) {
    return lower.toUpperCase()
  }
  if (!ENGLISH_WORDS.has(lower) && symbols.has(lower.toUpperCase())) {
    return lower.toUpperCase()
  }
  if (SYMBOL_SHAPED.test(lower)) return lower.toUpperCase()
  return lower
}

/** The first character, by code point (Python's `s[:1]`). */
const firstChar = (s: string) => String.fromCodePoint(s.codePointAt(0)!)

/**
 * Turn a title-cased gene name back into HGNC-style sentence case.
 *
 * `symbols` is the upper-cased set of primary gene symbols in the corpus,
 * used to spot symbols embedded in names ("BRCA1 DNA repair associated").
 * Names that already contain lower-case words are assumed to be correctly
 * cased at the source and returned unchanged.
 */
function recaseGeneName(name: string, symbols: Set<string>): string {
  const words = pySplit(name)
  const alreadyCased = words.some((word) => {
    const first = firstChar(word)
    return /^\p{L}$/u.test(first) && /^\p{Lowercase}$/u.test(first)
  })
  if (!words.length || alreadyCased) return name

  const out: string[] = []
  let prevWord = ''
  words.forEach((token, t) => {
    const parts = token.split(WORD_PARTS)
    const lastPart = parts.length - 2
    for (let i = 1; i < parts.length; i += 2) {
      const isLast = t === words.length - 1 && i === lastPart
      parts[i] = recaseWord(parts[i], prevWord, isLast, symbols)
      prevWord = parts[i].toLowerCase()
    }
    out.push(parts.join(''))
  })

  let result = out.join(' ')
  for (const [pattern, replacement] of PHRASE_FIXES) {
    result = result.replace(pattern, replacement)
  }
  // Sentence case for display; leaves "cAMP ..." or "p53 ..." alone.
  if (/^[a-z]+(?![A-Za-z0-9])/.test(result)) {
    result = result[0].toUpperCase() + result.slice(1)
  }
  return result
}

const upperSymbols = (genes: Iterable<{ symbol: string }>) =>
  new Set(Array.from(genes, (gene) => gene.symbol.toUpperCase()))

/**
 * Parse one JSONL line, refusing number literals that are not plain
 * integers: Python would write `1.0` back as `1.0`, and `JSON.parse` cannot
 * tell it from `1`.
 */
function parseJsonLine(line: string): Record<string, unknown> {
  return JSON.parse(
    line,
    (_key, value: unknown, context?: { source?: string }) => {
      if (typeof value === 'number' && !/^-?\d+$/.test(context?.source ?? '')) {
        throw new Error(`non-integer number ${context?.source} in ${line}`)
      }
      return value
    },
  ) as Record<string, unknown>
}

/** Recase the names in a genes JSONL file in place (e.g. the sample seed). */
function recaseGenesJsonl(path: string) {
  const rows = pyReadText(path)
    // Python reads text files with universal newlines.
    .split(/\r\n|\r|\n/)
    .filter((line) => pyStrip(line))
    .map(parseJsonLine) as unknown as SeedGene[]
  const symbols = upperSymbols(rows)
  for (const row of rows) row.name = recaseGeneName(row.name, symbols)
  writeFileSync(path, rows.map((row) => `${pyJsonDumps(row)}\n`).join(''))
  console.log(`Recased ${rows.length} gene names in ${path}`)
}

async function buildSeed(csvPath: string, outDir: string) {
  console.log(`Reading CSV from ${csvPath}`)
  try {
    statSync(csvPath)
  } catch {
    console.error(`ERROR: CSV not found at ${csvPath}`)
    process.exit(1)
  }
  mkdirSync(outDir, { recursive: true })
  const genesOut = join(outDir, 'genes.jsonl')
  const isoformsOut = join(outDir, 'isoforms.jsonl')

  const genes = new Map<string, SeedGene>()
  let isoformCount = 0
  const start = Date.now()

  const isoforms = createWriteStream(isoformsOut)
  for (const row of readCsvDicts(csvPath)) {
    const geneId = column(row, 'gene_id')!
    const transcriptId = column(row, 'transcript_id')!
    const species = deriveSpecies(transcriptId)

    if (!genes.has(geneId)) {
      const symbols: string[] = []
      for (let j = 1; j <= 28; j++) {
        const symbol = row[`sym${j}`]
        if (symbol) symbols.push(symbol)
      }
      const name = column(row, 'gene_name')!
      genes.set(geneId, {
        id: geneId,
        symbol: symbols[0] ?? name,
        name,
        species,
        alternateSymbols: serializeAlternateSymbols(symbols.slice(1)),
      })
    }

    const line = `${pyJsonDumps({
      id: transcriptId,
      geneId,
      codingSequenceLength: pyInt(column(row, 'coding_sequence_length')),
      proteinSequenceLength: pyInt(column(row, 'protein_length')),
      // A short row's missing field is Python's None.
      codingSequence: column(row, 'coding_sequence') ?? null,
      proteinSequence: column(row, 'protein_sequence') ?? null,
      species,
    })}\n`
    if (!isoforms.write(line)) await once(isoforms, 'drain')
    isoformCount++
    if (isoformCount % 25000 === 0)
      console.log(`  Parsed ${isoformCount} rows...`)
  }
  isoforms.end()
  await once(isoforms, 'finish')

  const symbols = upperSymbols(genes.values())
  let genesText = ''
  for (const gene of genes.values()) {
    gene.name = recaseGeneName(gene.name, symbols)
    genesText += `${pyJsonDumps(gene)}\n`
  }
  writeFileSync(genesOut, genesText)

  const mb = (path: string) => (statSync(path).size / 1024 / 1024).toFixed(1)
  const seconds = ((Date.now() - start) / 1000).toFixed(1)
  console.log(
    `Done! ${genes.size} genes (${mb(genesOut)} MB) + ${isoformCount} isoforms (${mb(isoformsOut)} MB) in ${seconds}s`,
  )
  console.log(`  ${genesOut}`)
  console.log(`  ${isoformsOut}`)
}

const { values } = parseArgs({
  options: {
    csv: { type: 'string', default: 'data/transcript_metadata.csv' },
    out: { type: 'string', default: 'data' },
    'recase-names': { type: 'string' },
  },
})

if (values['recase-names']) {
  recaseGenesJsonl(values['recase-names'])
} else {
  await buildSeed(values.csv, values.out)
}

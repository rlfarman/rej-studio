/**
 * Read a CSV file the way Python's `csv.DictReader` does with its default
 * (excel) dialect, so the data scripts ported from Python read the source
 * CSVs exactly as they did.
 *
 * - Fields are separated by `,`; a field may be quoted with `"`, and `""`
 *   inside a quoted field is one quote. Quoted fields may hold separators
 *   and line breaks, kept verbatim.
 * - Lines end in `\n`, `\r\n` or a lone `\r`.
 * - Python's lenient (non-strict) quirks are kept: a quote inside an
 *   unquoted field is literal, and text after a closing quote is appended
 *   (`"ab"c` reads as `abc`).
 * - The first record names the columns. Blank lines are skipped. A short
 *   row leaves the missing columns `undefined` (Python's `None`); extra
 *   fields on a long row are ignored (Python files them under a `None` key,
 *   which nothing here reads). A repeated column name keeps the last value.
 *
 * Python also caps a field at 131,072 characters and raises past it; this
 * reader has no cap.
 */
import { pyReadText } from './python-compat'

export type CsvRow = Record<string, string | undefined>

type State =
  | 'startRecord'
  | 'startField'
  | 'inField'
  | 'inQuotedField'
  | 'quoteInQuotedField'
  | 'eatCrnl'

/** End of a physical line, after its terminator (Python's EOL sentinel). */
const EOL = null

/** Physical lines, each with its terminator. */
function* physicalLines(text: string): Generator<string> {
  const lineEnd = /\r\n|\r|\n/g
  let start = 0
  while (lineEnd.exec(text)) {
    yield text.slice(start, lineEnd.lastIndex)
    start = lineEnd.lastIndex
  }
  if (start < text.length) yield text.slice(start)
}

/** Records as lists of fields, following CPython's `_csv.c` state machine. */
function* records(text: string): Generator<string[]> {
  let state: State = 'startRecord'
  let fields: string[] = []
  let field = ''
  let fieldHasChars = false

  const saveField = () => {
    fields.push(field)
    field = ''
    fieldHasChars = false
  }
  const addChar = (c: string) => {
    field += c
    fieldHasChars = true
  }
  const isLineBreak = (c: string | null) => c === '\n' || c === '\r'

  const step = (c: string | null) => {
    switch (state) {
      case 'startRecord':
        if (c === EOL) return // an empty line: no record
        if (isLineBreak(c)) {
          state = 'eatCrnl'
          return
        }
        state = 'startField'
      // falls through
      case 'startField':
        if (c === EOL || isLineBreak(c)) {
          saveField()
          state = c === EOL ? 'startRecord' : 'eatCrnl'
        } else if (c === '"') {
          state = 'inQuotedField'
        } else if (c === ',') {
          saveField()
        } else {
          addChar(c)
          state = 'inField'
        }
        return
      case 'inField':
        if (c === EOL || isLineBreak(c)) {
          saveField()
          state = c === EOL ? 'startRecord' : 'eatCrnl'
        } else if (c === ',') {
          saveField()
          state = 'startField'
        } else {
          addChar(c)
        }
        return
      case 'inQuotedField':
        if (c === EOL) return // the record continues on the next line
        if (c === '"') state = 'quoteInQuotedField'
        else addChar(c)
        return
      case 'quoteInQuotedField':
        if (c === '"') {
          addChar(c)
          state = 'inQuotedField'
        } else if (c === ',') {
          saveField()
          state = 'startField'
        } else if (c === EOL || isLineBreak(c)) {
          saveField()
          state = c === EOL ? 'startRecord' : 'eatCrnl'
        } else {
          addChar(c)
          state = 'inField'
        }
        return
      case 'eatCrnl':
        if (isLineBreak(c)) return
        if (c === EOL) {
          state = 'startRecord'
          return
        }
        throw new Error('new-line character seen in unquoted field')
    }
  }

  for (const line of physicalLines(text)) {
    for (const c of line) step(c)
    step(EOL)
    if (state === 'startRecord') {
      // A blank line yields an empty record, which DictReader skips.
      yield fields
      fields = []
    }
  }
  // Python's lenient reader keeps a final record cut off inside quotes.
  // (The cast: TypeScript can't see `step` reassigning `state`.)
  if (fieldHasChars || (state as State) === 'inQuotedField') {
    saveField()
    yield fields
  }
}

/** `row[name]`: a column the header lacks is an error (Python's KeyError). */
export function column(row: CsvRow, name: string): string | undefined {
  if (!(name in row)) throw new Error(`no column ${name} in the CSV header`)
  return row[name]
}

/** Every row of a CSV file, keyed by the header row's column names. */
export function* readCsvDicts(path: string): Generator<CsvRow> {
  let header: string[] | null = null
  for (const record of records(pyReadText(path))) {
    if (header === null) {
      header = record
      continue
    }
    if (record.length === 0) continue
    const row: CsvRow = {}
    header.forEach((name, i) => {
      row[name] = record[i]
    })
    yield row
  }
}

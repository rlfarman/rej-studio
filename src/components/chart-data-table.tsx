import { useSyncExternalStore } from 'react'
import { Download, Table2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { commonCopy } from '@/copy/common'
import { downloadTextFile } from '@/lib/download-file'
import { cn } from '@/lib/utils'

const copy = commonCopy.chartData

export type ChartCell = string | number

export interface ChartDataTableProps {
  /** What the table is, said once, for a reader who cannot see the chart. */
  caption: string
  columns: readonly string[]
  rows: ChartCell[][]
  /** Offer the same rows as a CSV under this name. Omit for no download. */
  csvFilename?: string
  /**
   * Remembers whether this table was open, for the rest of the session.
   * Charts of the same kind should share a key, so opening one opens the next.
   */
  storageKey: string
  className?: string
}

/**
 * Whether tables of this kind are open, for the rest of the session.
 *
 * Kept in session storage and read through `useSyncExternalStore`, so the
 * server renders the closed state, the client agrees with it on hydration,
 * and every table sharing a key opens together rather than one at a time.
 *
 * Storage is never required. In a private window, or wherever it is blocked,
 * the preference lives in memory for as long as the page does: a reader who
 * opens a table must still get one, which is the whole point.
 */
const STORAGE_PREFIX = 'chart-table:'
const CHANGED = 'chart-table-changed'

/** The fallback when session storage cannot be written, keyed the same way. */
const inMemory = new Map<string, boolean>()

/**
 * Set once a write has failed, after which this page stops consulting storage.
 *
 * Reading and writing can disagree: Safari at its quota, and private modes
 * generally, serve `getItem` happily and throw on `setItem`. Without this the
 * toggle wrote to a map that nothing read and the table never opened — a
 * button that renders, clicks and does nothing at all.
 */
let storageWritable = true

/** Test seam — clears what this module remembers between cases. */
export function resetChartTablePreferencesForTests() {
  inMemory.clear()
  storageWritable = true
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange)
  // Another tab in the same session can change it too.
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readPreference(key: string): boolean {
  if (!storageWritable) {
    // A write has already failed, so storage cannot answer for this page.
    return inMemory.get(key) ?? false
  }
  try {
    // While storage works it is the only source of truth, so a cleared
    // session really is cleared.
    return window.sessionStorage.getItem(STORAGE_PREFIX + key) === 'open'
  } catch {
    // Blocked or unavailable: what this page remembers is all there is.
    return inMemory.get(key) ?? false
  }
}

function useRemembered(key: string): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(
    subscribe,
    () => readPreference(key),
    // On the server there is no preference to read, and a table that rendered
    // open there would not match the client.
    () => false,
  )

  const remember = (next: boolean) => {
    // Remembered in memory either way: the write below can fail after a read
    // succeeded, and the click still has to open the table.
    inMemory.set(key, next)
    if (storageWritable) {
      try {
        window.sessionStorage.setItem(STORAGE_PREFIX + key, next ? 'open' : '')
      } catch {
        storageWritable = false
      }
    }
    window.dispatchEvent(new Event(CHANGED))
  }

  return [open, remember]
}

function toCsv(columns: readonly string[], rows: ChartCell[][]): string {
  const escape = (value: ChartCell) => {
    const text = String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [[...columns], ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\n')
}

/**
 * The numbers behind a chart, as a table.
 *
 * A picture is the fastest way to see a shape and no way at all to read a
 * value, copy one, or hear one. Every chart in the app therefore has the same
 * data available as text, built from the same rows the chart draws so the two
 * cannot disagree.
 *
 * It is closed by default, because an open table under every chart would
 * crowd the view and the brief is clear that nothing may slow the task down.
 * The choice is remembered for the session, so a reader who wants numbers gets
 * them from then on.
 */
export function ChartDataTable({
  caption,
  columns,
  rows,
  csvFilename,
  storageKey,
  className,
}: ChartDataTableProps) {
  const [open, setOpen] = useRemembered(storageKey)

  if (rows.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Table2 className="size-3.5" />
          {open ? copy.hide : copy.show}
        </Button>
        {open && csvFilename && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            aria-label={copy.downloadAria(caption)}
            onClick={() => downloadTextFile(csvFilename, toCsv(columns, rows))}
          >
            <Download className="size-3.5" />
            {copy.download}
          </Button>
        )}
      </div>

      {open && (
        // The height and the frame go on the table's own scroll container:
        // it is the element that scrolls, so the sticky header below has
        // something to stick to. See `containerClassName` on Table.
        <Table containerClassName="max-h-80 overflow-auto rounded-xl border">
          <TableCaption className="sr-only">{caption}</TableCaption>
          {/* Opaque, and above the rows: a translucent header lets the rows
              it is pinned over read through it. */}
          <TableHeader className="sticky top-0 z-10 bg-muted [&_th]:bg-muted">
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column} className="text-xs">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={cellIndex}
                    className={cn(
                      'text-xs',
                      typeof cell === 'number' && 'tabular-nums',
                    )}
                  >
                    {typeof cell === 'number' ? cell.toLocaleString() : cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

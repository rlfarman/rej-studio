import { AlignCenter, ChevronLeft, ChevronRight, Magnet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { designToolCopy } from '../../copy'

const copy = designToolCopy.splitPoint.goTo

export type QueryMode = 'idle' | 'bp' | 'sequence'

/**
 * A typed bp, with the way this UI writes one stripped off.
 *
 * Every bp in the editor renders as "1,083 bp", so pasting one back is the
 * natural gesture; it used to fall through to the sequence search and sit
 * there saying "0/0". Returns null when what is left is not a plain number.
 */
export function parseBpQuery(value: string): number | null {
  const digits = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '')
    .replace(/bp$/i, '')
  if (!/^\d+$/.test(digits)) return null
  const parsed = Number.parseInt(digits, 10)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * The bases a typed sequence query searches for.
 *
 * Taken as typed: a letter that is not a base makes the whole query invalid
 * rather than being dropped, because dropping it searched for something the
 * person had not asked for — "GGTGGNNN" quietly became "GGTGG" and reported
 * matches of that.
 */
export function parseSequenceQuery(value: string): {
  bases: string
  invalid: boolean
} {
  const letters = value.trim().replace(/\s+/g, '').toUpperCase()
  if (!letters) return { bases: '', invalid: false }
  const bases = letters.replace(/U/g, 'T')
  if (!/^[ACGT]+$/.test(bases)) return { bases: '', invalid: true }
  return { bases, invalid: false }
}

export function detectQueryMode(value: string): QueryMode {
  if (!value.trim()) return 'idle'
  return parseBpQuery(value) === null ? 'sequence' : 'bp'
}

export function Toolbar({
  queryValue,
  queryMode,
  sequenceLength,
  searchMatchCount,
  searchMatchIndex,
  searchInvalid,
  onQueryChange,
  onQuerySubmit,
  onSearchPrev,
  onSearchNext,
  onMidpoint,
  snapToSiteBp,
  onSnapToSite,
}: {
  queryValue: string
  queryMode: QueryMode
  sequenceLength: number
  searchMatchCount: number
  searchMatchIndex: number
  /** The query is not a position and not a DNA sequence either. */
  searchInvalid: boolean
  onQueryChange: (value: string) => void
  onQuerySubmit: () => void
  onSearchPrev: () => void
  onSearchNext: () => void
  onMidpoint: () => void
  /**
   * Where the nearest WGGW site is, when the caret is not already on it;
   * null hides the control rather than showing one that would do nothing.
   */
  snapToSiteBp: number | null
  onSnapToSite: () => void
}) {
  const isSequence = queryMode === 'sequence'
  const isBp = queryMode === 'bp'
  const bpValue = isBp ? parseBpQuery(queryValue) : null
  const maxPosition = Math.max(1, sequenceLength - 1)
  const bpOutOfRange =
    bpValue !== null && (bpValue < 1 || bpValue > maxPosition)

  // Why a query found nothing, rather than a bare "0/0". One line, so it is
  // read on a phone and announced where a `title` was neither.
  const message = bpOutOfRange
    ? copy.outOfRange(maxPosition.toLocaleString())
    : !isSequence
      ? null
      : searchInvalid
        ? copy.notSequence
        : searchMatchCount === 0
          ? copy.noMatch(queryValue.trim().toUpperCase())
          : null

  return (
    <div className="w-full space-y-1">
      <div className="flex w-full items-center gap-2 rounded-xl bg-background/25 px-1 py-0.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {copy.label}
          </span>
          <div className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-2xl border bg-background px-1.5">
            <input
              type="text"
              inputMode={isBp ? 'numeric' : 'text'}
              value={queryValue}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (isSequence && event.shiftKey) onSearchPrev()
                  else onQuerySubmit()
                }
              }}
              className={cn(
                'min-w-0 flex-1 bg-transparent font-mono text-[11px] outline-none',
                isSequence && 'uppercase',
              )}
              placeholder={copy.placeholder}
              aria-label={copy.aria}
              aria-invalid={message !== null || undefined}
            />
            {isSequence && searchMatchCount > 0 && (
              <>
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {searchMatchIndex + 1}/{searchMatchCount}
                </span>
                <button
                  type="button"
                  onClick={onSearchPrev}
                  title={copy.prevMatch}
                  aria-label={copy.prevMatch}
                  className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={onSearchNext}
                  title={copy.nextMatch}
                  aria-label={copy.nextMatch}
                  className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="size-3" />
                </button>
              </>
            )}
            {isBp && (
              <span className="font-mono text-[10px] tracking-[0.04em] text-muted-foreground uppercase">
                bp
              </span>
            )}
          </div>
        </div>
        {snapToSiteBp !== null && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSnapToSite}
            title={copy.snapToSiteAria(snapToSiteBp.toLocaleString())}
            aria-label={copy.snapToSiteAria(snapToSiteBp.toLocaleString())}
            className="text-muted-foreground hover:text-foreground"
          >
            <Magnet />
            {copy.snapToSite}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onMidpoint}
          title={copy.midpointTitle}
          className="text-muted-foreground hover:text-foreground"
        >
          <AlignCenter />
          {copy.midpoint}
        </Button>
      </div>
      {message && (
        <p role="status" className="px-1 text-[11px] text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  )
}

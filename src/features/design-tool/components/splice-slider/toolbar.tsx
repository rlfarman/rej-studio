import { AlignCenter, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type QueryMode = 'idle' | 'bp' | 'sequence'

export function detectQueryMode(value: string): QueryMode {
  const trimmed = value.trim()
  if (!trimmed) return 'idle'
  if (/^\d+$/.test(trimmed)) return 'bp'
  return 'sequence'
}

export function Toolbar({
  queryValue,
  queryMode,
  searchMatchCount,
  searchMatchIndex,
  onQueryChange,
  onQuerySubmit,
  onSearchPrev,
  onSearchNext,
  onMidpoint,
}: {
  queryValue: string
  queryMode: QueryMode
  searchMatchCount: number
  searchMatchIndex: number
  onQueryChange: (value: string) => void
  onQuerySubmit: () => void
  onSearchPrev: () => void
  onSearchNext: () => void
  onMidpoint: () => void
}) {
  const isSequence = queryMode === 'sequence'
  const isBp = queryMode === 'bp'
  return (
    <div className="flex w-full items-center gap-2 rounded-xl bg-background/25 px-1 py-0.5">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <span className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Go to
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
            placeholder="bp number or ACGT…"
            aria-label="Jump to bp or search sequence"
          />
          {isSequence && (
            <>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {searchMatchCount === 0
                  ? '0/0'
                  : `${searchMatchIndex + 1}/${searchMatchCount}`}
              </span>
              <button
                type="button"
                onClick={onSearchPrev}
                disabled={searchMatchCount === 0}
                title="Previous match (Shift+Enter)"
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="size-3" />
              </button>
              <button
                type="button"
                onClick={onSearchNext}
                disabled={searchMatchCount === 0}
                title="Next match (Enter)"
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onMidpoint}
        title="Snap caret to midpoint (m)"
        className="text-muted-foreground hover:text-foreground"
      >
        <AlignCenter />
        Midpoint
      </Button>
    </div>
  )
}

import { Fragment, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface SequenceRow {
  label: string
  text: string
  boundaryIndexes: number[]
  editedIndexes?: number[]
  hideBoundaries?: boolean
}

export function SequenceContextTable({ rows }: { rows: SequenceRow[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const center = () => {
      const target = scroller.querySelector<HTMLElement>('[data-focus="true"]')
      if (!target) return
      const sr = scroller.getBoundingClientRect()
      const tr = target.getBoundingClientRect()
      scroller.scrollLeft += tr.left + tr.width / 2 - (sr.left + sr.width / 2)
    }
    center()
    const ro = new ResizeObserver(center)
    ro.observe(scroller)
    return () => ro.disconnect()
  }, [rows])

  return (
    <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 font-mono text-[14px] leading-[1.2]">
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex h-[18px] items-center text-[10px] font-medium tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase"
          >
            {row.label}
          </div>
        ))}
      </div>
      <div
        ref={scrollerRef}
        className="[scrollbar-width:none] overflow-x-hidden [&::-webkit-scrollbar]:hidden"
        // Mask the leading and trailing edges so characters that fall
        // outside the visible window dissolve to transparent rather than
        // get hard-clipped mid-glyph. The center (around the splice) is
        // fully opaque.
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
        }}
      >
        <div className="mx-auto flex w-max max-w-full flex-col gap-1">
          {rows.map((row, rowIdx) => (
            <SequenceRowText
              key={row.label}
              row={row}
              isFocusRow={rowIdx === 0}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SequenceRowText({
  row,
  isFocusRow,
}: {
  row: SequenceRow
  isFocusRow: boolean
}) {
  const editedSet = new Set(row.editedIndexes ?? [])
  const boundarySet = new Set(row.boundaryIndexes)
  const focusIndex = row.text.indexOf('|')

  return (
    <div className="flex h-[18px] items-stretch whitespace-pre">
      {/* split(''), not spread: focusIndex comes from indexOf(), which
          counts UTF-16 code units, so the spans must be indexed the same way. */}
      {row.text.split('').map((char, index) => (
        <Fragment key={`${char}-${index}`}>
          <span
            data-focus={isFocusRow && index === focusIndex ? 'true' : undefined}
            className={cn(
              'inline-flex min-w-[1ch] items-center justify-center',
              char === '|' && 'font-bold text-primary',
              editedSet.has(index) && 'font-semibold',
            )}
          >
            {char}
          </span>
          {boundarySet.has(index) && (
            <span
              className="inline-flex w-[3px] items-center justify-center"
              aria-hidden="true"
            >
              <span
                className={cn(
                  'h-[1.05em] w-px',
                  row.hideBoundaries ? 'bg-transparent' : 'bg-border/80',
                )}
              />
            </span>
          )}
        </Fragment>
      ))}
    </div>
  )
}

'use client'

import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronRight,
  Copy,
  Info,
  Search,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type {
  ObjectiveEvaluationEntry,
  ObjectivesReport,
} from '@/features/design-tool/types/process-result'

// ---------- parsing the "objective" string into a nicer display ----------

interface ParsedObjective {
  name: string
  location: string | null
  args: string | null
  short: string
  full: string
}

function parseObjectiveString(objective: string): ParsedObjective {
  // Examples:
  //   "MaximizeCAI[0-1500](species=h_sapiens)"
  //   "AvoidPattern[0-1500](pattern:CG)"
  //   "UniquifyAllKmers[0-1500](k:10)"
  const locMatch = objective.match(
    /^([^\[(]+)(?:\[([^\]]+)\])?(?:\(([^)]*)\))?/,
  )
  if (!locMatch) {
    return {
      name: objective,
      location: null,
      args: null,
      short: objective,
      full: objective,
    }
  }
  const name = locMatch[1].trim()
  const location = locMatch[2]?.trim() || null
  const args = locMatch[3]?.trim() || null
  const short = args ? `${name} (${args})` : name
  return { name, location, args, short, full: objective }
}

// ---------- entry row ----------

interface DiffAnnotation {
  flip: 'up' | 'down' | null
  scoreDelta: number | null
}

interface EntryRowProps {
  entry: ObjectiveEvaluationEntry
  diff: DiffAnnotation
  query: string
  showDiffMarker: boolean
  isDimmed: boolean
}

function highlightMatches(text: string, query: string) {
  if (!query) return text
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${safe})`, 'gi'))
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded-[2px] bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/40 dark:text-amber-50"
      >
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

function EntryRow({
  entry,
  diff,
  query,
  showDiffMarker,
  isDimmed,
}: EntryRowProps) {
  const parsed = useMemo(
    () => parseObjectiveString(entry.objective),
    [entry.objective],
  )
  const locationCount = entry.locations?.length ?? 0

  return (
    <div
      data-objective={entry.objective}
      className={cn(
        'flex items-start gap-2 px-2.5 py-1.5 transition-opacity',
        !entry.passes && 'bg-red-500/[0.04] dark:bg-red-500/[0.06]',
        entry.passes && diff.flip === 'up' && 'bg-emerald-500/[0.05]',
        isDimmed && 'opacity-30',
      )}
    >
      {/* status icon */}
      <span
        className={cn(
          'mt-[1px] flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
          entry.passes
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-500/15 text-red-700 dark:text-red-400',
        )}
        title={entry.passes ? 'Passed' : 'Failed'}
      >
        {entry.passes ? '✓' : '✗'}
      </span>

      {/* flip marker (only on After panel) */}
      {showDiffMarker && diff.flip && (
        <span
          className={cn(
            'mt-[1px] flex size-4 shrink-0 items-center justify-center',
            diff.flip === 'up'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400',
          )}
          title={
            diff.flip === 'up'
              ? 'Newly passing (was failing before)'
              : 'Newly failing (was passing before)'
          }
        >
          {diff.flip === 'up' ? (
            <ArrowUp className="size-3" strokeWidth={3} />
          ) : (
            <ArrowDown className="size-3" strokeWidth={3} />
          )}
        </span>
      )}
      {showDiffMarker && !diff.flip && (
        <span className="mt-[1px] size-4 shrink-0" />
      )}

      {/* body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 font-mono text-[11px] leading-tight">
          <span className="truncate font-semibold" title={parsed.full}>
            {highlightMatches(parsed.name, query)}
          </span>
          {parsed.args && (
            <span
              className="text-muted-foreground truncate"
              title={parsed.full}
            >
              ({highlightMatches(parsed.args, query)})
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-tight">
          {entry.message && (
            <span className="truncate" title={entry.message}>
              {highlightMatches(entry.message, query)}
            </span>
          )}
          {locationCount > 0 && (
            <span className="tabular-nums">
              {locationCount} location{locationCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* score + delta */}
      <div className="mt-[1px] flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={cn(
            'font-mono text-[10px] tabular-nums',
            entry.score < 0
              ? 'text-red-700 dark:text-red-400'
              : entry.score > 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-muted-foreground',
          )}
        >
          {entry.score >= 0 ? '+' : ''}
          {entry.score.toFixed(2)}
        </span>
        {showDiffMarker &&
          diff.scoreDelta !== null &&
          diff.scoreDelta !== 0 && (
            <span
              className={cn(
                'rounded-sm px-1 py-0 font-mono text-[9px] font-semibold tabular-nums',
                diff.scoreDelta > 0
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-500/15 text-red-700 dark:text-red-400',
              )}
              title={`Score change vs. before: ${diff.scoreDelta > 0 ? '+' : ''}${diff.scoreDelta.toFixed(2)}`}
            >
              {diff.scoreDelta > 0 ? '+' : ''}
              {diff.scoreDelta.toFixed(2)}
            </span>
          )}
      </div>
    </div>
  )
}

// ---------- paired comparison panels ----------

interface ComparisonPanelProps {
  label: 'Before' | 'After'
  entries: ObjectiveEvaluationEntry[]
  otherEntries: Map<string, ObjectiveEvaluationEntry>
  totalScore: number | null
  scoreDelta: number | null
  rawText: string
  query: string
  visibleKeys: Set<string> | null
  scrollRef: React.RefObject<HTMLDivElement | null>
  onScroll: React.UIEventHandler<HTMLDivElement>
}

function ComparisonPanel({
  label,
  entries,
  otherEntries,
  totalScore,
  scoreDelta,
  rawText,
  query,
  visibleKeys,
  scrollRef,
  onScroll,
}: ComparisonPanelProps) {
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })
  const copyId = `objectives-${label.toLowerCase()}`
  const isAfter = label === 'After'

  return (
    <div className="bg-muted/40 flex flex-col overflow-hidden rounded-md border">
      <div className="bg-muted/60 flex items-center justify-between border-b px-2.5 py-1.5">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[10px]"
          onClick={() => copy(rawText, copyId)}
          disabled={!rawText}
        >
          {isCopied(copyId) ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
          {isCopied(copyId) ? 'Copied' : 'Copy raw'}
        </Button>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="bg-background/40 relative max-h-80 overflow-auto"
      >
        <div className="divide-border/60 divide-y">
          {(() => {
            type Row = {
              entry: ObjectiveEvaluationEntry
              flip: DiffAnnotation['flip']
              delta: number | null
              isSteadyPass: boolean
              isDimmed: boolean
            }
            const rows: Row[] = entries.map((entry) => {
              const match = otherEntries.get(entry.objective) ?? null
              let flip: DiffAnnotation['flip'] = null
              let delta: number | null = null
              if (match && isAfter) {
                if (entry.passes && !match.passes) flip = 'up'
                else if (!entry.passes && match.passes) flip = 'down'
                delta = entry.score - match.score
              }
              const isSteadyPass =
                isAfter && entry.passes && !!match && match.passes
              const isDimmed =
                visibleKeys !== null && !visibleKeys.has(entry.objective)
              return { entry, flip, delta, isSteadyPass, isDimmed }
            })

            // Only collapse in After panel, and only when no search filter is
            // active (so matches never hide inside a collapsed group).
            const shouldCollapse = isAfter && !query.trim()
            const MIN_GROUP = 2

            type Segment =
              | { kind: 'row'; row: Row }
              | { kind: 'group'; id: string; rows: Row[] }

            const segments: Segment[] = []
            if (shouldCollapse) {
              let buffer: Row[] = []
              const flush = () => {
                if (buffer.length >= MIN_GROUP) {
                  segments.push({
                    kind: 'group',
                    id: `g-${buffer[0].entry.objective}-${buffer.length}`,
                    rows: buffer,
                  })
                } else {
                  for (const r of buffer) segments.push({ kind: 'row', row: r })
                }
                buffer = []
              }
              for (const r of rows) {
                if (r.isSteadyPass) buffer.push(r)
                else {
                  flush()
                  segments.push({ kind: 'row', row: r })
                }
              }
              flush()
            } else {
              for (const r of rows) segments.push({ kind: 'row', row: r })
            }

            const renderRow = (row: Row) => (
              <EntryRow
                key={row.entry.objective}
                entry={row.entry}
                diff={{ flip: row.flip, scoreDelta: row.delta }}
                query={query}
                showDiffMarker={isAfter}
                isDimmed={row.isDimmed}
              />
            )

            return segments.map((seg) =>
              seg.kind === 'row' ? (
                renderRow(seg.row)
              ) : (
                <details key={seg.id} className="group/collapsed">
                  <summary className="hover:bg-muted/40 text-muted-foreground flex cursor-pointer items-center gap-1.5 px-2.5 py-1 text-[10px] select-none">
                    <ChevronRight className="size-3 shrink-0 transition-transform group-open/collapsed:rotate-90" />
                    <span>
                      {seg.rows.length} passing objective
                      {seg.rows.length === 1 ? '' : 's'}
                    </span>
                  </summary>
                  <div className="divide-border/60 divide-y">
                    {seg.rows.map(renderRow)}
                  </div>
                </details>
              ),
            )
          })()}
          {entries.length === 0 && (
            <div className="text-muted-foreground px-3 py-4 text-center text-xs italic">
              No objectives measured
            </div>
          )}
        </div>
        <div className="bg-background/95 sticky bottom-0 border-t backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 font-mono text-[11px]">
            <span className="text-foreground font-semibold">
              TOTAL{' '}
              <span className="tabular-nums">
                {totalScore !== null ? totalScore.toFixed(2) : '—'}
              </span>
            </span>
            {isAfter && scoreDelta !== null && (
              <span
                className={cn(
                  'rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  scoreDelta > 0.001
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : scoreDelta < -0.001
                      ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                      : 'text-muted-foreground',
                )}
              >
                {scoreDelta > 0 ? '+' : ''}
                {scoreDelta.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- summary bullets ----------

interface SummaryItem {
  label: string
  status: 'good' | 'improved' | 'worsened' | 'neutral'
}

function buildSummaryItems(
  before: ObjectivesReport,
  after: ObjectivesReport,
): SummaryItem[] {
  const items: SummaryItem[] = []

  if (before.total_score !== null && after.total_score !== null) {
    const delta = after.total_score - before.total_score
    items.push({
      label: `Objective score: ${before.total_score.toFixed(2)} → ${after.total_score.toFixed(2)}`,
      status:
        delta > 0.001 ? 'improved' : delta < -0.001 ? 'worsened' : 'neutral',
    })
  }

  const afterPass = after.entries.filter((e) => e.passes).length
  const afterTotal = after.entries.length
  const beforePass = before.entries.filter((e) => e.passes).length
  if (afterTotal > 0) {
    const improved = afterPass > beforePass
    items.push({
      label: `${afterPass} of ${afterTotal} objectives passed`,
      status:
        afterPass === afterTotal
          ? 'good'
          : improved
            ? 'improved'
            : afterPass < beforePass
              ? 'worsened'
              : 'neutral',
    })
  }

  // flips
  const beforeMap = new Map(before.entries.map((e) => [e.objective, e]))
  let flipsUp = 0
  let flipsDown = 0
  for (const a of after.entries) {
    const b = beforeMap.get(a.objective)
    if (!b) continue
    if (a.passes && !b.passes) flipsUp++
    else if (!a.passes && b.passes) flipsDown++
  }
  if (flipsUp > 0) {
    items.push({
      label: `${flipsUp} objective${flipsUp === 1 ? '' : 's'} fixed`,
      status: 'improved',
    })
  }
  if (flipsDown > 0) {
    items.push({
      label: `${flipsDown} objective${flipsDown === 1 ? '' : 's'} regressed`,
      status: 'worsened',
    })
  }

  return items
}

// ---------- raw text fallback ----------

function RawTextFallback({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Before
        </span>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 font-mono text-[11px] whitespace-pre-wrap">
          {before || 'No objectives measured'}
        </pre>
      </div>
      <div className="space-y-1">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          After
        </span>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 font-mono text-[11px] whitespace-pre-wrap">
          {after || 'No objectives measured'}
        </pre>
      </div>
    </div>
  )
}

// ---------- top-level summary ----------

interface ObjectivesSummaryProps {
  reportBefore: ObjectivesReport
  reportAfter: ObjectivesReport
  textBefore: string
  textAfter: string
}

export function ObjectivesSummary({
  reportBefore,
  reportAfter,
  textBefore,
  textAfter,
}: ObjectivesSummaryProps) {
  const summaryItems = useMemo(
    () => buildSummaryItems(reportBefore, reportAfter),
    [reportBefore, reportAfter],
  )

  const scoreDelta =
    reportBefore.total_score !== null && reportAfter.total_score !== null
      ? reportAfter.total_score - reportBefore.total_score
      : null

  const beforeMap = useMemo(
    () => new Map(reportBefore.entries.map((e) => [e.objective, e])),
    [reportBefore.entries],
  )
  const afterMap = useMemo(
    () => new Map(reportAfter.entries.map((e) => [e.objective, e])),
    [reportAfter.entries],
  )

  const hasStructured =
    reportBefore.entries.length > 0 || reportAfter.entries.length > 0

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const visibleKeys = useMemo<Set<string> | null>(() => {
    if (!deferredSearch.trim()) return null
    const q = deferredSearch.toLowerCase()
    const keys = new Set<string>()
    const check = (e: ObjectiveEvaluationEntry) =>
      e.objective.toLowerCase().includes(q) ||
      e.message.toLowerCase().includes(q)
    for (const e of reportBefore.entries) if (check(e)) keys.add(e.objective)
    for (const e of reportAfter.entries) if (check(e)) keys.add(e.objective)
    return keys
  }, [deferredSearch, reportBefore.entries, reportAfter.entries])

  const beforeRef = useRef<HTMLDivElement | null>(null)
  const afterRef = useRef<HTMLDivElement | null>(null)
  const syncingRef = useRef(false)

  const syncScroll = useCallback(
    (source: 'before' | 'after'): React.UIEventHandler<HTMLDivElement> =>
      (e) => {
        if (syncingRef.current) {
          syncingRef.current = false
          return
        }
        const src = e.currentTarget
        const target =
          source === 'before' ? afterRef.current : beforeRef.current
        if (!target) return
        if (target.scrollTop === src.scrollTop) return
        syncingRef.current = true
        target.scrollTop = src.scrollTop
      },
    [],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Info className="text-muted-foreground size-4" />
        Optimization Summary
      </div>
      {summaryItems.length > 0 && (
        <ul className="space-y-1">
          {summaryItems.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  item.status === 'good' && 'bg-emerald-500',
                  item.status === 'improved' && 'bg-emerald-500',
                  item.status === 'worsened' && 'bg-red-500',
                  item.status === 'neutral' && 'bg-muted-foreground',
                )}
              />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <details className="group">
        <summary className="text-muted-foreground cursor-pointer text-xs hover:underline">
          {hasStructured
            ? 'Show full optimizer report'
            : 'Show full optimizer output'}
        </summary>
        <div className="mt-3 space-y-2">
          {hasStructured ? (
            <>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Filter objectives…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 pr-7 pl-7 text-xs"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear filter"
                    onClick={() => setSearch('')}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ComparisonPanel
                  label="Before"
                  entries={reportBefore.entries}
                  otherEntries={afterMap}
                  totalScore={reportBefore.total_score}
                  scoreDelta={scoreDelta}
                  rawText={textBefore}
                  query={deferredSearch}
                  visibleKeys={visibleKeys}
                  scrollRef={beforeRef}
                  onScroll={syncScroll('before')}
                />
                <ComparisonPanel
                  label="After"
                  entries={reportAfter.entries}
                  otherEntries={beforeMap}
                  totalScore={reportAfter.total_score}
                  scoreDelta={scoreDelta}
                  rawText={textAfter}
                  query={deferredSearch}
                  visibleKeys={visibleKeys}
                  scrollRef={afterRef}
                  onScroll={syncScroll('after')}
                />
              </div>
            </>
          ) : (
            <RawTextFallback before={textBefore} after={textAfter} />
          )}
        </div>
      </details>
    </div>
  )
}

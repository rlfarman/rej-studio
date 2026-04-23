'use client'

import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  FileText,
  Search,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { CopyButton } from '@/components/copy-button'
import type {
  ObjectiveEvaluationEntry,
  ObjectivesReport,
} from '@/features/design-tool/types/process-result'
import { deriveKeyMetrics } from '@/features/design-tool/utils/objective-metrics'

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
        className="bg-warning/30 dark:bg-warning/25 dark:text-foreground rounded-[2px] px-0.5 text-inherit"
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
        !entry.passes && 'bg-danger/[0.04] dark:bg-danger/[0.06]',
        entry.passes && diff.flip === 'up' && 'bg-success/[0.05]',
        isDimmed && 'opacity-30',
      )}
    >
      {/* status icon */}
      <span
        className={cn(
          'type-micro mt-[1px] flex size-4 shrink-0 items-center justify-center rounded-full font-bold',
          entry.passes
            ? 'bg-success/15 text-success-soft'
            : 'bg-danger/15 text-danger-soft',
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
            diff.flip === 'up' ? 'text-success-soft' : 'text-danger-soft',
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
        <div className="type-nano flex items-baseline gap-1.5 font-mono leading-tight">
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
        <div className="text-muted-foreground type-micro mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight">
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
            'type-micro font-mono tabular-nums',
            entry.score < 0
              ? 'text-danger-soft'
              : entry.score > 0
                ? 'text-success-soft'
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
                  ? 'bg-success/15 text-success-soft'
                  : 'bg-danger/15 text-danger-soft',
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
  const isAfter = label === 'After'

  return (
    <div className="bg-muted/40 flex flex-col overflow-hidden rounded-md border">
      <div className="bg-muted/60 flex items-center justify-between border-b px-2.5 py-1.5">
        <span className="type-overline">{label}</span>
        <CopyButton
          text={rawText}
          copiedLabel="Copied"
          className="type-micro h-6 gap-1 px-1.5"
          disabled={!rawText}
        >
          Copy raw
        </CopyButton>
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
                  <summary className="hover:bg-muted/40 text-muted-foreground type-micro flex cursor-pointer items-center gap-1.5 px-2.5 py-1 select-none">
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
          <div className="type-nano flex items-center justify-between gap-2 px-2.5 py-1.5 font-mono">
            <span className="text-foreground font-semibold">
              TOTAL{' '}
              <span className="tabular-nums">
                {totalScore !== null ? totalScore.toFixed(2) : '—'}
              </span>
            </span>
            {isAfter && scoreDelta !== null && (
              <span
                className={cn(
                  'type-micro rounded-sm px-1.5 py-0.5 font-semibold tabular-nums',
                  scoreDelta > 0.001
                    ? 'bg-success/15 text-success-soft'
                    : scoreDelta < -0.001
                      ? 'bg-danger/15 text-danger-soft'
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
  hint?: string
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

  const beforeMetrics = deriveKeyMetrics(before)
  const afterMetrics = deriveKeyMetrics(after)

  const deltaStatus = (
    b: number,
    a: number,
    lowerIsBetter: boolean,
  ): SummaryItem['status'] => {
    if (a === b) return 'neutral'
    const improved = lowerIsBetter ? a < b : a > b
    if (lowerIsBetter && a === 0 && b > 0) return 'good'
    return improved ? 'improved' : 'worsened'
  }

  if (beforeMetrics.spliceDonors > 0 || afterMetrics.spliceDonors > 0) {
    items.push({
      label: `Potential splice donor sites: ${beforeMetrics.spliceDonors} → ${afterMetrics.spliceDonors}`,
      status: deltaStatus(
        beforeMetrics.spliceDonors,
        afterMetrics.spliceDonors,
        true,
      ),
    })
  }

  if (beforeMetrics.spliceAcceptors > 0 || afterMetrics.spliceAcceptors > 0) {
    items.push({
      label: `Potential splice acceptor sites: ${beforeMetrics.spliceAcceptors} → ${afterMetrics.spliceAcceptors}`,
      status: deltaStatus(
        beforeMetrics.spliceAcceptors,
        afterMetrics.spliceAcceptors,
        true,
      ),
    })
  }

  if (afterMetrics.caiScore !== null) {
    const b = beforeMetrics.caiScore
    const a = afterMetrics.caiScore
    items.push({
      label:
        b !== null
          ? `CAI: ${b.toFixed(3)} → ${a.toFixed(3)}`
          : `CAI: ${a.toFixed(3)}`,
      status: b !== null ? deltaStatus(b, a, false) : 'neutral',
    })
  }

  if (afterMetrics.kmerPassed) {
    items.push({
      label: 'No repetitive 10-mers remaining',
      status: 'good',
    })
  } else if (afterMetrics.kmerScore !== null) {
    const b = beforeMetrics.kmerScore
    const a = afterMetrics.kmerScore
    items.push({
      label: `Kmer complexity: ${a.toFixed(1)}`,
      status: b !== null ? deltaStatus(b, a, false) : 'neutral',
      hint: 'If the current sequence is too difficult to synthesize, rerun the optimization with higher weight on reducing kmer complexity.',
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

// ---------- markdown export ----------

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function buildMarkdownReport(
  before: ObjectivesReport,
  after: ObjectivesReport,
): string {
  const lines: string[] = []
  lines.push('## Optimization objectives')
  lines.push('')
  const fmtTotal = (n: number | null) => (n === null ? '—' : n.toFixed(2))
  lines.push(
    `**Total score:** ${fmtTotal(before.total_score)} → ${fmtTotal(after.total_score)}`,
  )
  lines.push('')

  const beforeMap = new Map(before.entries.map((e) => [e.objective, e]))
  const afterMap = new Map(after.entries.map((e) => [e.objective, e]))
  const keys = new Set<string>([...beforeMap.keys(), ...afterMap.keys()])

  lines.push('| Status | Objective | Before | After | Δ | Note |')
  lines.push('| --- | --- | ---: | ---: | ---: | --- |')
  for (const key of keys) {
    const b = beforeMap.get(key)
    const a = afterMap.get(key)
    const afterEntry = a ?? b
    let status = '—'
    if (a && b) {
      if (a.passes && !b.passes) status = '↑ fixed'
      else if (!a.passes && b.passes) status = '↓ regressed'
      else if (a.passes) status = '✓ passing'
      else status = '✗ failing'
    } else if (a) {
      status = a.passes ? '✓ passing' : '✗ failing'
    } else if (b) {
      status = b.passes ? '✓ passing' : '✗ failing'
    }
    const bs = b ? b.score.toFixed(2) : '—'
    const as = a ? a.score.toFixed(2) : '—'
    const delta = a && b ? (a.score - b.score).toFixed(2) : '—'
    const msg = afterEntry?.message ?? ''
    lines.push(
      `| ${status} | \`${mdEscape(key)}\` | ${bs} | ${as} | ${delta} | ${mdEscape(msg)} |`,
    )
  }
  return lines.join('\n')
}

// ---------- raw text fallback ----------

// DNAChisel's objectives_text_summary() uses box-drawing characters as a
// visual gutter (┍ for a root node, ├/│/└ for children). These render
// inconsistently across fonts, so we strip them and recover the nesting as
// a real CSS-bordered indent instead.
const TREE_CHARS = /[┍┌├│└─┐┘┤┬┴┼╷╵╶╴]/g
const TREE_CHARS_TEST = /[┍┌┐]/
const TREE_CHILD_TEST = /[├│└]/

function classifyRawLine(raw: string): {
  depth: number
  cleaned: string
  status: 'pass' | 'fail' | null
} {
  const isRoot = TREE_CHARS_TEST.test(raw)
  const isChild = !isRoot && TREE_CHILD_TEST.test(raw)
  const depth = isChild ? 1 : 0
  let status: 'pass' | 'fail' | null = null
  if (/✔|✓/.test(raw) || /\bPASS\b/.test(raw)) status = 'pass'
  else if (/✘|✗/.test(raw) || /\bFAIL\b/.test(raw)) status = 'fail'
  const cleaned = raw.replace(TREE_CHARS, '').replace(/\s+/g, ' ').trim()
  return { depth, cleaned, status }
}

function RawReportView({ text }: { text: string }) {
  if (!text.trim()) {
    return (
      <div className="bg-muted text-muted-foreground rounded-md p-3 text-xs italic">
        No objectives measured
      </div>
    )
  }
  const lines = text.split('\n')
  const width = String(lines.length).length
  return (
    <div className="bg-muted type-nano max-h-64 overflow-auto rounded-md font-mono">
      <div>
        {lines.map((raw, i) => {
          const { depth, cleaned, status } = classifyRawLine(raw)
          if (!cleaned) {
            return (
              <div
                key={i}
                className="flex items-start gap-2 px-2"
                aria-hidden="true"
              >
                <span
                  className="text-muted-foreground/40 shrink-0 text-right tabular-nums select-none"
                  style={{ width: `${width}ch` }}
                >
                  {i + 1}
                </span>
                <span>&nbsp;</span>
              </div>
            )
          }
          return (
            <div
              key={i}
              id={`raw-line-${i + 1}`}
              className="hover:bg-muted/40 group flex items-start gap-2 px-2"
            >
              <span
                className="text-muted-foreground/50 shrink-0 text-right tabular-nums select-none"
                style={{ width: `${width}ch` }}
              >
                {i + 1}
              </span>
              <div
                className={cn(
                  'min-w-0 flex-1 break-words',
                  depth > 0 && 'border-border/60 ml-2 border-l pl-2',
                )}
              >
                {status === 'pass' && (
                  <span className="text-success-soft">{cleaned}</span>
                )}
                {status === 'fail' && (
                  <span className="text-danger-soft">{cleaned}</span>
                )}
                {status === null && <span>{cleaned}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RawTextFallback({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <span className="type-overline">Before</span>
        <RawReportView text={before} />
      </div>
      <div className="space-y-1">
        <span className="type-overline">After</span>
        <RawReportView text={after} />
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

  const markdownReport = useMemo(
    () => buildMarkdownReport(reportBefore, reportAfter),
    [reportBefore, reportAfter],
  )

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
      {summaryItems.length > 0 && (
        <ul className="space-y-1">
          {summaryItems.map((item) => (
            <li key={item.label} className="space-y-0.5">
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    item.status === 'good' && 'bg-success',
                    item.status === 'improved' && 'bg-success',
                    item.status === 'worsened' && 'bg-danger',
                    item.status === 'neutral' && 'bg-muted-foreground',
                  )}
                />
                {item.label}
              </div>
              {item.hint && (
                <p className="text-muted-foreground ml-3.5 text-xs italic">
                  {item.hint}
                </p>
              )}
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
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1">
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
                <CopyButton
                  text={markdownReport}
                  icon={FileText}
                  variant="outline"
                  copiedLabel="Copied"
                  className="type-nano h-7 shrink-0 gap-1 px-2"
                >
                  Copy as MD
                </CopyButton>
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

/**
 * A finished design as Markdown: what the panel shows, in a file.
 *
 * The exported ZIP used to carry only a text dump — no date, no split point
 * as such, none of the metrics the panel leads with, and the objectives
 * pasted with DNAChisel's box-drawing gutter that the UI deliberately strips.
 * This is the same report the "Copy report" button copies, so the file and
 * the screen say the same things.
 *
 * Every line is filled from the result itself. Nothing here says where the
 * sequence came from — nothing downstream can tell a pasted sequence from an
 * isoform's own CDS — and a field the result does not carry produces no line
 * rather than a guess.
 */

import type {
  ObjectivesReport,
  ProcessResult,
} from '@/features/design-tool/types/process-result'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { SPECIES_DISPLAY_NAME, isSpecies } from '@/lib/bio/species'
import { escapeMarkdownTableCell } from '@/features/design-tool/utils/markdown-table'
import { buildMethodsParagraph } from '@/features/design-tool/utils/methods-paragraph'
import { computeResultMetrics } from '@/features/design-tool/utils/result-metrics'
import { designToolCopy } from '@/features/design-tool/copy'

const reportCopy = designToolCopy.results.report

/** The objectives, before and after, as one table. */
export function buildObjectivesMarkdown(
  before: ObjectivesReport,
  after: ObjectivesReport,
): string {
  const lines: string[] = []
  lines.push(`## ${reportCopy.objectivesHeading}`)
  lines.push('')
  const fmtTotal = (n: number | null) => (n === null ? '—' : n.toFixed(2))
  lines.push(
    `**${reportCopy.totalScore}** ${fmtTotal(before.total_score)} → ${fmtTotal(after.total_score)}`,
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
      `| ${status} | \`${escapeMarkdownTableCell(key)}\` | ${bs} | ${as} | ${delta} | ${escapeMarkdownTableCell(msg)} |`,
    )
  }
  return lines.join('\n')
}

const INTRON_MARKER_RE = /(\[REJ5\]|\[REJ3\]|\[STIMINTRON\])/g

function bases(sequence: string): number {
  return sequence.replace(INTRON_MARKER_RE, '').length
}

function num(value: number, digits = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** One row of a two-column table, or nothing when there is no value. */
function row(label: string, value: string | null): string | null {
  return value === null ? null : `| ${label} | ${value} |`
}

function metricRow(
  label: string,
  before: number | null,
  after: number | null,
  digits = 1,
): string | null {
  if (before === null && after === null) return null
  return `| ${label} | ${before === null ? '—' : num(before, digits)} | ${
    after === null ? '—' : num(after, digits)
  } |`
}

interface DesignReportInput {
  result: ProcessResult
  /** The options block, as the run recorded them (see `ResultsPanel`). */
  optionsUsed: string
  /** The species the run was submitted with; 'none' means codon usage was left alone. */
  species: DesignToolSpecies
  /** Overridable so the output is testable. */
  exportedAt?: Date
}

/**
 * The whole report. `exportedAt` is the time the file was made, which is the
 * only date most results carry: a run's own start time exists only in a run
 * record, and the Rust optimizer does not emit one yet.
 */
export function buildDesignReportMarkdown({
  result,
  optionsUsed,
  species,
  exportedAt = new Date(),
}: DesignReportInput): string {
  const metrics = computeResultMetrics(result, species)
  const fivePrime = bases(result.seq5)
  const threePrime = bases(result.seq3)

  const sections: string[] = []

  sections.push(
    [
      `# ${result.name}`,
      '',
      `| ${reportCopy.fieldColumn} | ${reportCopy.valueColumn} |`,
      '| --- | --- |',
      ...[
        row(reportCopy.fields.exportedAt, exportedAt.toISOString()),
        row(
          reportCopy.fields.inputLength,
          `${num(bases(result.original_sequence))} bp`,
        ),
        row(reportCopy.fields.splitPoint, num(result.split_point)),
        row(reportCopy.fields.fivePrime, `${num(fivePrime)} bp`),
        row(reportCopy.fields.threePrime, `${num(threePrime)} bp`),
        row(
          reportCopy.fields.wggwSplit,
          result.used_wggw_as_split ? reportCopy.yes : reportCopy.no,
        ),
        row(
          reportCopy.fields.species,
          isSpecies(species)
            ? SPECIES_DISPLAY_NAME[species]
            : reportCopy.speciesNone,
        ),
        row(
          reportCopy.fields.runTime,
          `${num(result.processing_time_seconds, 1)} s`,
        ),
        result.seed == null
          ? null
          : row(reportCopy.fields.seed, String(result.seed)),
      ].filter((line) => line !== null),
    ].join('\n'),
  )

  const metricRows = [
    metricRow('Objective score', metrics.score.before, metrics.score.after, 2),
    metricRow('GC %', metrics.gc?.before ?? null, metrics.gc?.after ?? null),
    metricRow(
      'CpG',
      metrics.cpg?.before ?? null,
      metrics.cpg?.after ?? null,
      0,
    ),
    metricRow('Identity to input %', null, metrics.identity),
    metricRow(
      'CAI',
      metrics.cai?.before ?? null,
      metrics.cai?.after ?? null,
      3,
    ),
    metricRow(
      designToolCopy.results.metrics.caiObjective,
      metrics.keyBefore.caiObjectiveScore,
      metrics.keyAfter.caiObjectiveScore,
      2,
    ),
    metricRow(
      'Splice donors',
      metrics.keyBefore.spliceDonors,
      metrics.keyAfter.spliceDonors,
      0,
    ),
    metricRow(
      'Splice acceptors',
      metrics.keyBefore.spliceAcceptors,
      metrics.keyAfter.spliceAcceptors,
      0,
    ),
  ].filter((line) => line !== null)
  sections.push(
    [
      `## ${reportCopy.metricsHeading}`,
      '',
      `| ${reportCopy.metricColumn} | ${reportCopy.beforeColumn} | ${reportCopy.afterColumn} |`,
      '| --- | ---: | ---: |',
      ...metricRows,
    ].join('\n'),
  )

  // The options as the run was given them, verbatim: a fenced block, so the
  // JSON can be read back out of the file.
  const optionsIsJson = optionsUsed.trimStart().startsWith('{')
  sections.push(
    [
      `## ${reportCopy.optionsHeading}`,
      '',
      ...(optionsIsJson
        ? ['```json', optionsUsed, '```']
        : [escapeMarkdownTableCell(optionsUsed)]),
    ].join('\n'),
  )

  if (result.wggw_info) {
    const siteLabels: Record<string, string> = {
      main: designToolCopy.results.wggwTable.main,
      stim5: designToolCopy.results.wggwTable.stim5,
      stim3: designToolCopy.results.wggwTable.stim3,
    }
    sections.push(
      [
        `## ${reportCopy.wggwHeading}`,
        '',
        '| Site | Position | Motif | Distance from split | Original codons | New codons |',
        '| --- | ---: | --- | ---: | --- | --- |',
        ...Object.entries(result.wggw_info).map(
          ([siteType, info]) =>
            `| ${siteLabels[siteType] ?? siteType} | ${num(info.position)} | \`${info.motif}\` | ${num(info.distance_from_split)} bp | ${info.original_codons.join(' / ')} | ${info.new_codons.join(' / ')} |`,
        ),
      ].join('\n'),
    )
  }

  sections.push(
    buildObjectivesMarkdown(
      result.objectives_report_before,
      result.objectives_report_after,
    ),
  )

  // Only a run that recorded one: the paragraph states facts from the record
  // and nothing else.
  if (result.run_record) {
    sections.push(
      [
        `## ${reportCopy.methodsHeading}`,
        '',
        buildMethodsParagraph(result.run_record),
      ].join('\n'),
    )
  }

  return `${sections.join('\n\n')}\n`
}

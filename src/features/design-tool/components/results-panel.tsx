import { memo, useState } from 'react'
import {
  Download,
  Scissors,
  ChevronRight,
  ChevronDown,
  Check,
  Copy,
  FileText,
  Package,
  Link2,
  Activity,
  Shield,
  FlaskConical,
  TrendingUp,
  ClipboardCheck,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MetricCell } from '@/components/metric-cell'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { CopyButton } from '@/components/copy-button'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { toast } from '@/lib/toast'
import { SequenceVisualizations } from './sequence-visualizations'
import { CodonChanges } from './codon-changes'
import { JunctionContext } from './junction-context'
import { RestrictionSiteMap } from './restriction-site-map'
import { CodonDeltaStrip } from './codon-delta-strip'
import { AavResults } from './aav-size-estimator'
import { SplitBar } from '@/components/bio/split-bar'
import { ObjectivesSummary } from './objectives-output'
import { RunRecordCard } from './run-record-card'
import { ObjectiveReplay } from './objective-replay'
import { formatFasta } from '@/lib/bio/fasta'
import { downloadTextFile } from '@/lib/download-file'
import { isSpecies } from '@/lib/bio/species'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { computeResultMetrics } from '@/features/design-tool/utils/result-metrics'
import { buildDesignReportMarkdown } from '@/features/design-tool/utils/design-report'
import {
  buildObjectiveSteps,
  countOutcomes,
} from '@/features/design-tool/utils/objective-steps'
import { SPECIES_DISPLAY_NAME } from '@/lib/bio/species'
import { toCodons } from '@/lib/bio/genetic-code'
import {
  GC_TARGET_MAX_PERCENT,
  GC_TARGET_MIN_PERCENT,
} from '@/features/design-tool/utils/job-constants'
import { formatOptionsForReport } from '@/features/design-tool/utils/form-handler'
import type { FormValues } from '@/features/design-tool/types/form-schema'
import { designToolCopy } from '../copy'
import { errorsCopy } from '@/copy/errors'

const resultsCopy = designToolCopy.results

interface ResultsPanelProps {
  result: ProcessResult
  /**
   * The inputs this run was submitted with, as the run recorded them — never
   * the live form. The exported report states the options a design was made
   * with, so reading them off a form the person has since edited made the
   * file misdescribe itself.
   */
  runValues: FormValues | null
}

function SplitVisualization({
  seq5Length,
  seq3Length,
  splitPoint,
}: {
  seq5Length: number
  seq3Length: number
  splitPoint: number
}) {
  const total = seq5Length + seq3Length
  const percentage = total > 0 ? (seq5Length / total) * 100 : 50

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <Scissors className="size-4 text-muted-foreground" />
        <span>
          {resultsCopy.splitAtPosition}{' '}
          <span className="font-mono font-medium">
            {splitPoint.toLocaleString()}
          </span>{' '}
          {resultsCopy.splitRatio(
            Math.round(percentage),
            Math.round(100 - percentage),
          )}
        </span>
      </div>
      <SplitBar fivePrimeLength={seq5Length} threePrimeLength={seq3Length} />
    </div>
  )
}

// The GC target band the optimizer enforces, as a MetricCell target: a GC
// value that drifted out of range must not read as an improvement just
// because the number went up.
const GC_TARGET = { min: GC_TARGET_MIN_PERCENT, max: GC_TARGET_MAX_PERCENT }

function MetricsStrip({
  result,
  species,
}: {
  result: ProcessResult
  species: DesignToolSpecies
}) {
  const stats = computeResultMetrics(result, species)

  const showDonors =
    stats.keyBefore.spliceDonors > 0 || stats.keyAfter.spliceDonors > 0
  const showAcceptors =
    stats.keyBefore.spliceAcceptors > 0 || stats.keyAfter.spliceAcceptors > 0
  // The index when it can be computed; otherwise the optimizer's own score
  // under its own name, which is not a CAI.
  const showCai = stats.cai?.after != null
  const showCaiObjective = !showCai && stats.keyAfter.caiObjectiveScore !== null

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
      <MetricCell
        label="Score"
        before={stats.score.before}
        after={stats.score.after}
      />
      <MetricCell
        label="GC"
        before={stats.gc?.before ?? null}
        after={stats.gc?.after ?? null}
        unit="%"
        target={GC_TARGET}
      />
      <MetricCell
        label="CpG"
        before={stats.cpg?.before ?? null}
        after={stats.cpg?.after ?? null}
        lowerIsBetter
      />
      <MetricCell
        label="Identity"
        before={null}
        after={stats.identity}
        unit="%"
      />
      {showDonors && (
        <MetricCell
          label="Splice donors"
          before={stats.keyBefore.spliceDonors}
          after={stats.keyAfter.spliceDonors}
          lowerIsBetter
        />
      )}
      {showAcceptors && (
        <MetricCell
          label="Splice acceptors"
          before={stats.keyBefore.spliceAcceptors}
          after={stats.keyAfter.spliceAcceptors}
          lowerIsBetter
        />
      )}
      {showCai && (
        <MetricCell
          label={resultsCopy.metrics.cai}
          before={stats.cai?.before ?? null}
          after={stats.cai?.after ?? null}
          formatter={(n) => n.toFixed(3)}
        />
      )}
      {showCaiObjective && (
        <MetricCell
          label={resultsCopy.metrics.caiObjective}
          before={stats.keyBefore.caiObjectiveScore}
          after={stats.keyAfter.caiObjectiveScore}
          formatter={(n) => n.toFixed(2)}
        />
      )}
    </div>
  )
}

const INTRON_MARKER_RE = /(\[REJ5\]|\[REJ3\]|\[STIMINTRON\])/g

function renderSequenceWithIntrons(sequence: string) {
  const parts = sequence.split(INTRON_MARKER_RE)
  return parts.map((part, i) => {
    if (part === '[REJ5]' || part === '[REJ3]' || part === '[STIMINTRON]') {
      const isFive = part === '[REJ5]'
      const isStim = part === '[STIMINTRON]'
      const tip = isStim
        ? resultsCopy.intronTooltip.stimulatory
        : isFive
          ? resultsCopy.intronTooltip.fivePrime
          : resultsCopy.intronTooltip.threePrime
      return (
        <Tooltip key={i}>
          <TooltipTrigger
            render={
              <span
                className={
                  isStim
                    ? 'cursor-help rounded-sm bg-accent px-1 font-semibold text-accent-foreground'
                    : isFive
                      ? 'cursor-help rounded-sm bg-info/15 px-1 font-semibold text-info-soft dark:text-info'
                      : 'cursor-help rounded-sm bg-primary/15 px-1 font-semibold text-primary dark:bg-primary/40 dark:text-primary-foreground'
                }
              />
            }
          >
            {part}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{tip}</TooltipContent>
        </Tooltip>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function SequenceCard({
  label,
  sequence,
  fastaName,
}: {
  label: string
  sequence: string
  fastaName: string
}) {
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })
  const justCopied = isCopied('fasta') || isCopied('seq')
  const displayLength = sequence.replace(INTRON_MARKER_RE, '').length
  return (
    <div className="space-y-2 rounded-2xl border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{label}</span>
          <Badge variant="secondary" className="type-micro">
            {displayLength.toLocaleString()} bp
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 px-3 text-xs"
                aria-label={resultsCopy.sequenceCard.exportAria(label)}
              />
            }
          >
            {justCopied ? (
              <Check className="size-3.5" />
            ) : (
              <Download className="size-3.5" />
            )}
            {justCopied
              ? resultsCopy.sequenceCard.copied
              : resultsCopy.sequenceCard.exportLabel}
            <ChevronDown className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => copy(formatFasta(fastaName, sequence), 'fasta')}
            >
              <FileText className="size-4" />
              {resultsCopy.sequenceCard.copyFasta}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copy(sequence, 'seq')}>
              <Copy className="size-4" />
              {resultsCopy.sequenceCard.copySequence}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                downloadTextFile(
                  `${fastaName}.fasta`,
                  formatFasta(fastaName, sequence),
                )
              }
            >
              <Download className="size-4" />
              {resultsCopy.sequenceCard.downloadFasta}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <pre className="max-h-40 overflow-auto rounded-xl bg-muted p-2.5 font-mono text-xs break-all whitespace-pre-wrap">
        {renderSequenceWithIntrons(sequence)}
      </pre>
    </div>
  )
}

function SequenceViewer({ result }: { result: ProcessResult }) {
  return (
    <div className="space-y-3">
      <SequenceCard
        label={resultsCopy.sequenceCard.fiveLabel}
        sequence={result.seq5}
        fastaName={`${result.name}_5prime`}
      />
      <SequenceCard
        label={resultsCopy.sequenceCard.threeLabel}
        sequence={result.seq3}
        fastaName={`${result.name}_3prime`}
      />
      <SequenceCard
        label={resultsCopy.sequenceCard.fullLabel}
        sequence={result.optimized_sequence}
        fastaName={`${result.name}_optimized`}
      />
    </div>
  )
}

function ExpandableRow({
  title,
  summary,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string
  summary?: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t py-2 first:border-t-0">
      {/* The toggle lives inside a heading: a completed run then has an
          outline a screen reader can navigate, instead of a flat run of
          buttons. */}
      <h3 className="text-sm font-medium">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-2 py-1 text-left text-sm font-medium select-none"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-90',
            )}
          />
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-medium">{title}</span>
          {summary && (
            <span className="text-xs font-normal text-muted-foreground">
              — {summary}
            </span>
          )}
        </button>
      </h3>
      {open && <div className="pt-3 pb-2 pl-6">{children}</div>}
    </div>
  )
}

function WggwTable({
  wggwInfo,
}: {
  wggwInfo: NonNullable<ProcessResult['wggw_info']>
}) {
  const siteLabels: Record<string, string> = {
    main: resultsCopy.wggwTable.main,
    stim5: resultsCopy.wggwTable.stim5,
    stim3: resultsCopy.wggwTable.stim3,
  }
  return (
    <div className="overflow-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{resultsCopy.wggwTable.headers.site}</TableHead>
            <TableHead>{resultsCopy.wggwTable.headers.position}</TableHead>
            <TableHead>{resultsCopy.wggwTable.headers.motif}</TableHead>
            <TableHead>{resultsCopy.wggwTable.headers.distance}</TableHead>
            <TableHead>
              {resultsCopy.wggwTable.headers.originalCodons}
            </TableHead>
            <TableHead>{resultsCopy.wggwTable.headers.newCodons}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(wggwInfo).map(([siteType, info]) => (
            <TableRow key={siteType}>
              <TableCell className="font-medium">
                {siteLabels[siteType] ?? siteType}
              </TableCell>
              <TableCell className="font-mono">
                {info.position.toLocaleString()}
              </TableCell>
              <TableCell className="font-mono">{info.motif}</TableCell>
              <TableCell>
                {info.distance_from_split.toLocaleString()} bp
              </TableCell>
              <TableCell className="font-mono">
                {info.original_codons.join(' | ')}
              </TableCell>
              <TableCell className="font-mono">
                {info.new_codons.join(' | ')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** One-line summary of AAV fit for the expandable header. */
const AAV_OVERHEAD_BP = 1540
const AAV_PACKAGING_LIMIT = 4700
function aavSummary(seq5: number, seq3: number) {
  const label = (total: number) => {
    if (total <= AAV_PACKAGING_LIMIT) return 'fits'
    if (total <= AAV_PACKAGING_LIMIT + 300) return 'tight'
    return 'over'
  }
  return `5' ${label(seq5 + AAV_OVERHEAD_BP)} · 3' ${label(seq3 + AAV_OVERHEAD_BP)}`
}

function ResultsPanelImpl({ result, runValues }: ResultsPanelProps) {
  // Everything the panel and the export say about the run's inputs comes
  // from the run itself. Older entries saved no inputs; the report then says
  // so rather than describing some other set of options.
  const species: DesignToolSpecies = runValues?.species ?? 'none'
  // The stored inputs already carry the WGGW sites the request was built
  // with (the form resolves them before submitting), so this is the very
  // options block the optimizer was given.
  const optionsUsed = runValues
    ? formatOptionsForReport(runValues)
    : resultsCopy.optionsUnavailable

  // The ZIP library loads on the first download, not with the results.
  const handleDownloadZip = async () => {
    try {
      const { downloadResultsZip } =
        await import('@/features/design-tool/utils/build-zip')
      downloadResultsZip(result, { optionsUsed, species })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : errorsCopy.download.failure,
      )
    }
  }

  // Strip markers for length display
  const seq5Clean = result.seq5.replace(INTRON_MARKER_RE, '')
  const seq3Clean = result.seq3.replace(INTRON_MARKER_RE, '')
  const wggwCount = result.wggw_info ? Object.keys(result.wggw_info).length : 0

  const codonChangesSummary = (() => {
    const orig = toCodons(result.original_sequence)
    const opt = toCodons(result.optimized_sequence)
    const total = Math.min(orig.length, opt.length)
    let changed = 0
    for (let i = 0; i < total; i++) {
      if (
        orig[i].toUpperCase().replace(/U/g, 'T') !==
        opt[i].toUpperCase().replace(/U/g, 'T')
      )
        changed++
    }
    return resultsCopy.summaries.codonsChanged(
      changed.toLocaleString(),
      total.toLocaleString(),
    )
  })()

  // Counted off the structured report, which is what the section itself
  // reports. Counting ✔ marks in the optimizer's text gave a second total
  // three lines away from the first ("26 of 30 passed" over "26 of 32
  // objectives passed"), because the text ticks only some of the objectives.
  // A result with no structured report gets no summary rather than a count
  // arrived at a different way.
  const objectivesEntries = result.objectives_report_after.entries
  const objectivesSummary =
    objectivesEntries.length > 0
      ? resultsCopy.summaries.objectivesPassed(
          objectivesEntries.filter((entry) => entry.passes).length,
          objectivesEntries.length,
        )
      : undefined

  const changedSummary = (() => {
    const counts = countOutcomes(
      buildObjectiveSteps(
        result.objectives_report_before,
        result.objectives_report_after,
      ),
    )
    // Every outcome the replay would show, so the collapsed row never reads
    // as "nothing happened" when something did. Objectives that simply held
    // are not news and are left out; a row with none of these has nothing to
    // open it for, and gets no summary at all.
    const summary = resultsCopy.summaries.changed(counts)
    return summary || undefined
  })()

  const junctionSummary = resultsCopy.summaries.junction(
    result.split_point.toLocaleString(),
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle
              render={
                <h2 className="text-lg font-semibold tracking-tight">
                  {resultsCopy.heading}
                </h2>
              }
            />
            {/* The run's duration is the job header's status line, right
                above; saying it here too repeated it a few lines apart. */}
            {result.used_wggw_as_split && (
              <CardDescription className="flex items-center gap-1.5">
                <Badge variant="secondary">{resultsCopy.wggwSplitBadge}</Badge>
              </CardDescription>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {/* The paper-ready artifact, at the top level: it used to be a
                "Copy as MD" three interactions deep, inside a <details>
                inside the collapsed objectives row. Built on click, not on
                render. */}
            <CopyButton
              text={() =>
                buildDesignReportMarkdown({ result, optionsUsed, species })
              }
              icon={FileText}
              variant="outline"
              size="default"
              copiedLabel={resultsCopy.copiedReport}
              aria-label={resultsCopy.copyReportAria}
              className="gap-1.5"
            >
              {resultsCopy.copyReport}
            </CopyButton>
            <Button
              type="button"
              size="default"
              className="gap-1.5 bg-accent text-accent-foreground shadow-sm hover:bg-accent/80"
              onClick={handleDownloadZip}
            >
              <Download className="size-4" />
              {resultsCopy.downloadZip}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <SplitVisualization
          seq5Length={seq5Clean.length}
          seq3Length={seq3Clean.length}
          splitPoint={result.split_point}
        />

        <MetricsStrip result={result} species={species} />

        <SequenceViewer result={result} />

        <div className="-mx-1">
          <ExpandableRow
            title={resultsCopy.sections.visualizations}
            icon={Activity}
          >
            <SequenceVisualizations
              original={result.original_sequence}
              optimized={result.optimized_sequence}
              splitPoint={result.split_point}
            />
          </ExpandableRow>
          <ExpandableRow
            title={resultsCopy.sections.codonChanges}
            icon={Shield}
            summary={codonChangesSummary}
            defaultOpen={false}
          >
            <CodonChanges
              original={result.original_sequence}
              optimized={result.optimized_sequence}
              splitPoint={result.split_point}
            />
          </ExpandableRow>
          <ExpandableRow
            title={resultsCopy.sections.junctionContext}
            icon={Scissors}
            summary={junctionSummary}
          >
            <JunctionContext
              sequence={result.optimized_sequence}
              splitPoint={result.split_point}
              wggwMotif={result.wggw_info?.main?.motif}
            />
          </ExpandableRow>
          {/* Deep dives start collapsed: fully expanded, the panel ran to
              ~2.5k px before the user had seen the split or the metrics. */}
          <ExpandableRow
            title={resultsCopy.sections.restrictionSites}
            icon={FlaskConical}
            defaultOpen={false}
          >
            <RestrictionSiteMap
              original={result.original_sequence}
              optimized={result.optimized_sequence}
            />
          </ExpandableRow>
          {isSpecies(species) && (
            <ExpandableRow
              title={resultsCopy.sections.codonUsageDelta}
              icon={TrendingUp}
              summary={SPECIES_DISPLAY_NAME[species]}
              defaultOpen={false}
            >
              <CodonDeltaStrip
                original={result.original_sequence}
                optimized={result.optimized_sequence}
                species={species}
              />
            </ExpandableRow>
          )}
          <ExpandableRow
            title={resultsCopy.sections.aavPackaging}
            icon={Package}
            summary={aavSummary(seq5Clean.length, seq3Clean.length)}
          >
            <AavResults
              seq5Length={seq5Clean.length}
              seq3Length={seq3Clean.length}
            />
          </ExpandableRow>
          {wggwCount > 0 && result.wggw_info && (
            <ExpandableRow
              title={resultsCopy.sections.wggwDetails}
              icon={Link2}
              summary={resultsCopy.summaries.wggwSites(wggwCount)}
            >
              <WggwTable wggwInfo={result.wggw_info} />
            </ExpandableRow>
          )}
          <ExpandableRow
            title={resultsCopy.sections.replay}
            icon={TrendingUp}
            summary={changedSummary}
          >
            <ObjectiveReplay
              reportBefore={result.objectives_report_before}
              reportAfter={result.objectives_report_after}
              sequenceLength={result.optimized_sequence.length}
            />
          </ExpandableRow>
          <ExpandableRow
            title={resultsCopy.sections.objectivesReport}
            icon={ClipboardCheck}
            summary={objectivesSummary}
            defaultOpen={false}
          >
            <ObjectivesSummary
              reportBefore={result.objectives_report_before}
              reportAfter={result.objectives_report_after}
              textBefore={result.objectives_before}
              textAfter={result.objectives_after}
            />
          </ExpandableRow>
          <ExpandableRow
            title={resultsCopy.sections.runRecord}
            icon={FileText}
            summary={
              result.run_record
                ? resultsCopy.runRecord.summary
                : // Said on the collapsed row, so the section can be skipped
                  // rather than opened to find out there is nothing in it.
                  resultsCopy.runRecord.unavailableSummary
            }
            defaultOpen={false}
          >
            <RunRecordCard record={result.run_record} name={result.name} />
          </ExpandableRow>
        </div>
      </CardContent>
    </Card>
  )
}

// Memoized: the parent form re-renders on every keystroke, but the result
// object and the run's stored inputs only change when a new job completes,
// so default referential equality is sufficient.
export const ResultsPanel = memo(ResultsPanelImpl)

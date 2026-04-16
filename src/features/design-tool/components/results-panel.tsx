'use client'

import { memo, useMemo } from 'react'
import { m } from 'motion/react'
import {
  Download,
  Clock,
  Scissors,
  ChevronRight,
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
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fadeUp } from '@/lib/motion'
import { MetricCell } from '@/components/metric-cell'
import { CopyButton } from '@/components/copy-button'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { toast } from 'sonner'
import { downloadResultsZip } from '@/features/design-tool/utils/build-zip'
import { SequenceVisualizations } from './sequence-visualizations'
import { CodonChanges } from './codon-changes'
import { JunctionContext } from './junction-context'
import { RestrictionSiteMap } from './restriction-site-map'
import { CodonDeltaStrip } from './codon-delta-strip'
import { AavResults } from './aav-size-estimator'
import { SplitBar } from '@/components/bio/split-bar'
import { ObjectivesSummary } from './objectives-output'
import { formatFasta } from '@/lib/bio/fasta'
import { downloadTextFile } from '@/lib/download-file'
import { isSpecies } from '@/lib/bio/species'
import type { DesignToolSpecies } from '@/features/design-tool/types/species-options'
import { computeGcPercent, countCpG } from '@/lib/bio/sequence-utils'
import { deriveKeyMetrics } from '@/features/design-tool/utils/objective-metrics'
import { SPECIES_DISPLAY_NAME } from '@/lib/bio/species'
import { toCodons } from '@/lib/bio/genetic-code'

interface ResultsPanelProps {
  result: ProcessResult
  optionsUsed: string
  species: DesignToolSpecies
}

/** Parse the DNAChisel objectives text into a digestible summary. */
function parseObjectives(text: string) {
  const totalMatch = text.match(/TOTAL OBJECTIVES SCORE:\s*([-\d.]+)/)
  const totalScore = totalMatch ? parseFloat(totalMatch[1]) : null

  const passedCount = (text.match(/✔/g) || []).length
  const failedLines = text.match(/Failed\./g) || []
  const failedCount = failedLines.length

  return { totalScore, passedCount, failedCount }
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
        <Scissors className="text-muted-foreground size-4" />
        <span>
          Split at position{' '}
          <span className="font-mono font-medium">
            {splitPoint.toLocaleString()}
          </span>{' '}
          ({Math.round(percentage)}% / {Math.round(100 - percentage)}%)
        </span>
      </div>
      <SplitBar fivePrimeLength={seq5Length} threePrimeLength={seq3Length} />
    </div>
  )
}

function MetricsStrip({ result }: { result: ProcessResult }) {
  const stats = useMemo(() => {
    const before = parseObjectives(result.objectives_before)
    const after = parseObjectives(result.objectives_after)
    const keyBefore = deriveKeyMetrics(result.objectives_report_before)
    const keyAfter = deriveKeyMetrics(result.objectives_report_after)

    const orig = result.original_sequence
    const opt = result.optimized_sequence
    if (!orig || !opt) {
      return {
        before,
        after,
        keyBefore,
        keyAfter,
        gc: null,
        cpg: null,
        identity: null,
      }
    }

    const gcBefore = computeGcPercent(orig)
    const gcAfter = computeGcPercent(opt)
    const cpgBefore = countCpG(orig)
    const cpgAfter = countCpG(opt)

    let changed = 0
    const len = Math.min(orig.length, opt.length)
    for (let i = 0; i < len; i++) if (orig[i] !== opt[i]) changed++
    const identity = len > 0 ? 100 - (changed / len) * 100 : 100

    return {
      before,
      after,
      keyBefore,
      keyAfter,
      gc: { before: gcBefore, after: gcAfter },
      cpg: { before: cpgBefore, after: cpgAfter },
      identity,
    }
  }, [result])

  const totalObjectives = stats.after.passedCount + stats.after.failedCount
  const showDonors =
    stats.keyBefore.spliceDonors > 0 || stats.keyAfter.spliceDonors > 0
  const showAcceptors =
    stats.keyBefore.spliceAcceptors > 0 || stats.keyAfter.spliceAcceptors > 0
  const showCai = stats.keyAfter.caiScore !== null

  return (
    <div className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      <MetricCell
        label="Score"
        before={stats.before.totalScore}
        after={stats.after.totalScore}
      />
      <MetricCell
        label="Objectives"
        before={null}
        after={totalObjectives > 0 ? stats.after.passedCount : null}
        formatter={(n) => `${n} / ${totalObjectives}`}
      />
      <MetricCell
        label="GC"
        before={stats.gc?.before ?? null}
        after={stats.gc?.after ?? null}
        unit="%"
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
          label="CAI"
          before={stats.keyBefore.caiScore}
          after={stats.keyAfter.caiScore}
          formatter={(n) => n.toFixed(3)}
        />
      )}
    </div>
  )
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
  return (
    <div className="bg-muted/30 space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{label}</span>
          <Badge variant="secondary" className="text-[10px]">
            {sequence.length.toLocaleString()} bp
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 px-3 text-xs"
            onClick={() =>
              downloadTextFile(
                `${fastaName}.fasta`,
                formatFasta(fastaName, sequence),
              )
            }
            aria-label={`Download ${label} as FASTA`}
          >
            <Download className="size-3.5" />
            FASTA
          </Button>
          <CopyButton
            text={() => formatFasta(fastaName, sequence)}
            className="h-9 gap-1.5 px-3 text-xs"
            aria-label={`Copy ${label} FASTA to clipboard`}
          >
            FASTA
          </CopyButton>
          <CopyButton
            text={sequence}
            className="h-9 gap-1.5 px-3 text-xs"
            copiedLabel="Copied"
            aria-label={`Copy ${label} raw sequence to clipboard`}
          >
            Copy
          </CopyButton>
        </div>
      </div>
      <pre className="bg-muted max-h-40 overflow-auto rounded-md p-2.5 font-mono text-xs break-all whitespace-pre-wrap">
        {sequence}
      </pre>
    </div>
  )
}

function SequenceViewer({ result }: { result: ProcessResult }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <SequenceCard
        label="5' Sequence"
        sequence={result.seq5}
        fastaName={`${result.name}_5prime`}
      />
      <SequenceCard
        label="3' Sequence"
        sequence={result.seq3}
        fastaName={`${result.name}_3prime`}
      />
      <SequenceCard
        label="Full Optimized"
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
  return (
    <details
      className="group border-t py-2 first:border-t-0"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-sm select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-90" />
        <Icon className="text-muted-foreground size-4 shrink-0" />
        <span className="font-medium">{title}</span>
        {summary && (
          <span className="text-muted-foreground text-xs">— {summary}</span>
        )}
      </summary>
      <div className="pt-3 pb-2 pl-6">{children}</div>
    </details>
  )
}

function WggwTable({
  wggwInfo,
}: {
  wggwInfo: NonNullable<ProcessResult['wggw_info']>
}) {
  const siteLabels: Record<string, string> = {
    main: 'Main Junction',
    stim5: "5' Stimulatory",
    stim3: "3' Stimulatory",
  }
  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Site</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Motif</TableHead>
            <TableHead>Distance</TableHead>
            <TableHead>Original Codons</TableHead>
            <TableHead>New Codons</TableHead>
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

function ResultsPanelImpl({ result, optionsUsed, species }: ResultsPanelProps) {
  const handleDownloadZip = () => {
    try {
      downloadResultsZip(result, optionsUsed)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed.')
    }
  }

  // Strip markers for length display
  const seq5Clean = result.seq5.replace(/\[REJ5\]/g, '')
  const seq3Clean = result.seq3.replace(/\[REJ3\]/g, '')
  const wggwCount = result.wggw_info ? Object.keys(result.wggw_info).length : 0

  const codonChangesSummary = useMemo(() => {
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
    return `${changed.toLocaleString()} of ${total.toLocaleString()} codons changed`
  }, [result.original_sequence, result.optimized_sequence])

  const objectivesSummary = useMemo(() => {
    const after = parseObjectives(result.objectives_after)
    const total = after.passedCount + after.failedCount
    if (total === 0) return undefined
    return `${after.passedCount} of ${total} passed`
  }, [result.objectives_after])

  const junctionSummary = `±18 bp at ${result.split_point.toLocaleString()}`

  return (
    <m.div variants={fadeUp} initial="hidden" animate="visible">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Results</CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <Clock className="size-3" />
                Completed in {result.processing_time_seconds}s
                {result.used_wggw_as_split && (
                  <Badge variant="secondary" className="ml-1">
                    WGGW split
                  </Badge>
                )}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleDownloadZip}
            >
              <Download className="size-4" />
              Download ZIP
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SplitVisualization
            seq5Length={seq5Clean.length}
            seq3Length={seq3Clean.length}
            splitPoint={result.split_point}
          />

          <MetricsStrip result={result} />

          <SequenceViewer result={result} />

          <div className="-mx-1">
            <ExpandableRow title="Sequence visualizations" icon={Activity}>
              <SequenceVisualizations
                original={result.original_sequence}
                optimized={result.optimized_sequence}
                splitPoint={result.split_point}
              />
            </ExpandableRow>
            <ExpandableRow
              title="Codon changes"
              icon={Shield}
              summary={codonChangesSummary}
            >
              <CodonChanges
                original={result.original_sequence}
                optimized={result.optimized_sequence}
                splitPoint={result.split_point}
              />
            </ExpandableRow>
            <ExpandableRow
              title="Junction context"
              icon={Scissors}
              summary={junctionSummary}
            >
              <JunctionContext
                sequence={result.optimized_sequence}
                splitPoint={result.split_point}
                wggwMotif={result.wggw_info?.main?.motif}
              />
            </ExpandableRow>
            <ExpandableRow title="Restriction site map" icon={FlaskConical}>
              <RestrictionSiteMap
                original={result.original_sequence}
                optimized={result.optimized_sequence}
              />
            </ExpandableRow>
            {isSpecies(species) && (
              <ExpandableRow
                title="Codon usage delta"
                icon={TrendingUp}
                summary={SPECIES_DISPLAY_NAME[species]}
              >
                <CodonDeltaStrip
                  original={result.original_sequence}
                  optimized={result.optimized_sequence}
                  species={species}
                />
              </ExpandableRow>
            )}
            <ExpandableRow
              title="AAV packaging"
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
                title="WGGW motif details"
                icon={Link2}
                summary={`${wggwCount} site${wggwCount === 1 ? '' : 's'}`}
              >
                <WggwTable wggwInfo={result.wggw_info} />
              </ExpandableRow>
            )}
            <ExpandableRow
              title="Objectives report"
              icon={ClipboardCheck}
              summary={objectivesSummary}
            >
              <ObjectivesSummary
                reportBefore={result.objectives_report_before}
                reportAfter={result.objectives_report_after}
                textBefore={result.objectives_before}
                textAfter={result.objectives_after}
              />
            </ExpandableRow>
          </div>
        </CardContent>
      </Card>
    </m.div>
  )
}

// Memoized: the parent form re-renders on every keystroke, but the result
// object only changes when a new job completes. optionsUsed is a string
// snapshot, so default referential equality is sufficient.
export const ResultsPanel = memo(ResultsPanelImpl)

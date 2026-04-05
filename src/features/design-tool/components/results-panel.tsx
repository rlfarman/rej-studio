'use client'

import { memo } from 'react'
import { m } from 'motion/react'
import { Download, Copy, Check, Clock, Scissors } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { fadeUp } from '@/lib/motion'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { toast } from 'sonner'
import { downloadResultsZip } from '@/features/design-tool/utils/build-zip'
import { ComparisonPanel } from './comparison-panel'
import { AavResults } from './aav-size-estimator'
import { ObjectivesSummary } from './objectives-output'
import { formatFasta } from '@/lib/bio/fasta'

interface ResultsPanelProps {
  result: ProcessResult
  optionsUsed: string
}

function SequenceBlock({
  label,
  sequence,
  copyId,
  fastaName,
}: {
  label: string
  sequence: string
  copyId: string
  fastaName?: string
}) {
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="secondary">
            {sequence.length.toLocaleString()} bp
          </Badge>
        </div>
        <div className="flex gap-1">
          {fastaName && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() =>
                copy(formatFasta(fastaName, sequence), `${copyId}-fasta`)
              }
            >
              {isCopied(`${copyId}-fasta`) ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
              FASTA
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => copy(sequence, copyId)}
          >
            {isCopied(copyId) ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
            {isCopied(copyId) ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
      <pre className="bg-muted max-h-32 overflow-auto rounded-md p-3 font-mono text-xs break-all whitespace-pre-wrap">
        {sequence}
      </pre>
    </div>
  )
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
      <div className="flex h-6 w-full overflow-hidden rounded-md border">
        <div
          className="bg-primary/15 border-primary flex min-w-0 items-center justify-center border-r-2 transition-all"
          style={{ width: `${percentage}%` }}
        >
          <span className="text-primary truncate px-1.5 text-[10px] font-medium">
            5&apos; &middot; {seq5Length.toLocaleString()} bp
          </span>
        </div>
        <div className="bg-muted/50 flex min-w-0 flex-1 items-center justify-center">
          <span className="text-muted-foreground truncate px-1.5 text-[10px] font-medium">
            3&apos; &middot; {seq3Length.toLocaleString()} bp
          </span>
        </div>
      </div>
    </div>
  )
}

function WggwDetails({
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
    <div className="space-y-3">
      <span className="text-sm font-medium">WGGW Motif Details</span>
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
    </div>
  )
}

function ResultsPanelImpl({ result, optionsUsed }: ResultsPanelProps) {
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

  return (
    <m.div variants={fadeUp} initial="hidden" animate="visible">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
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
        <CardContent className="space-y-8">
          <SplitVisualization
            seq5Length={seq5Clean.length}
            seq3Length={seq3Clean.length}
            splitPoint={result.split_point}
          />

          <Separator />

          <div className="space-y-6">
            <SequenceBlock
              label="5' Sequence"
              sequence={result.seq5}
              copyId="seq5"
              fastaName={`${result.name}_5prime`}
            />

            <SequenceBlock
              label="3' Sequence"
              sequence={result.seq3}
              copyId="seq3"
              fastaName={`${result.name}_3prime`}
            />

            <SequenceBlock
              label="Optimized Full Sequence"
              sequence={result.optimized_sequence}
              copyId="optimized"
              fastaName={`${result.name}_optimized`}
            />
          </div>

          <Separator />

          <ObjectivesSummary
            reportBefore={result.objectives_report_before}
            reportAfter={result.objectives_report_after}
            textBefore={result.objectives_before}
            textAfter={result.objectives_after}
          />

          <Separator />

          <ComparisonPanel result={result} />

          <Separator />

          <AavResults
            seq5Length={seq5Clean.length}
            seq3Length={seq3Clean.length}
          />

          {result.wggw_info && Object.keys(result.wggw_info).length > 0 && (
            <>
              <Separator />
              <WggwDetails wggwInfo={result.wggw_info} />
            </>
          )}
        </CardContent>
      </Card>
    </m.div>
  )
}

// Memoized: the parent form re-renders on every keystroke, but the result
// object only changes when a new job completes. optionsUsed is a string
// snapshot, so default referential equality is sufficient.
export const ResultsPanel = memo(ResultsPanelImpl)

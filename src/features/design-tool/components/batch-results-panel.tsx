'use client'

import { useMemo } from 'react'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Download,
  ExternalLink,
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
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  useBatchJobStore,
  useBatchEntryStatuses,
  type BatchEntryStatus,
  type BatchJob,
} from '@/features/design-tool/hooks/use-batch-job'
import { useJobHistory } from '@/features/design-tool/hooks/use-job-history'
import { downloadBatchZip } from '@/features/design-tool/utils/build-batch-zip'
import { toast } from 'sonner'
import Link from 'next/link'

function StatusIcon({ status }: { status: BatchEntryStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-4 text-emerald-500" />
    case 'failed':
      return <XCircle className="text-destructive size-4" />
    case 'running':
    case 'submitting':
      return <Loader2 className="text-primary size-4 animate-spin" />
    case 'pending':
      return <Clock className="text-muted-foreground size-4" />
  }
}

function statusLabel(status: BatchEntryStatus): string {
  switch (status) {
    case 'completed':
      return 'Done'
    case 'failed':
      return 'Failed'
    case 'running':
      return 'Running'
    case 'submitting':
      return 'Submitting'
    case 'pending':
      return 'Pending'
  }
}

interface BatchResultsPanelProps {
  batchId: string
}

export function BatchResultsPanel({ batchId }: BatchResultsPanelProps) {
  const batch = useBatchJobStore(
    (s) => s.batches.find((b) => b.batchId === batchId) ?? null,
  )
  const entryStatuses = useBatchEntryStatuses(batchId)
  const jobHistoryEntries = useJobHistory((s) => s.entries)

  const stats = useMemo(() => {
    if (!entryStatuses) return null
    const completed = entryStatuses.filter(
      (e) => e.status === 'completed',
    ).length
    const failed = entryStatuses.filter((e) => e.status === 'failed').length
    const running = entryStatuses.filter(
      (e) => e.status === 'running' || e.status === 'submitting',
    ).length
    const pending = entryStatuses.filter((e) => e.status === 'pending').length
    const total = entryStatuses.length
    const progress = total > 0 ? ((completed + failed) / total) * 100 : 0
    return { completed, failed, running, pending, total, progress }
  }, [entryStatuses])

  if (!batch || !entryStatuses || !stats) return null

  const isSettled = stats.running === 0 && stats.pending === 0
  const hasResults = stats.completed > 0

  const handleDownload = () => {
    try {
      const results: { name: string; jobId: string }[] = []
      for (const entry of entryStatuses) {
        if (entry.status === 'completed' && entry.jobId) {
          results.push({ name: entry.name, jobId: entry.jobId })
        }
      }
      const completedResults = results
        .map((r) => {
          const histEntry = jobHistoryEntries.find((e) => e.id === r.jobId)
          if (!histEntry?.result) return null
          return { name: r.name, result: histEntry.result }
        })
        .filter(Boolean) as {
        name: string
        result: import('@/features/design-tool/types/process-result').ProcessResult
      }[]

      if (completedResults.length === 0) {
        toast.error('No completed results to download.')
        return
      }

      downloadBatchZip(completedResults)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Batch Results</CardTitle>
            <CardDescription>
              {isSettled
                ? `${stats.completed} of ${stats.total} completed`
                : `Processing ${stats.running} of ${stats.total} sequences...`}
            </CardDescription>
          </div>
          {hasResults && isSettled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleDownload}
            >
              <Download className="size-4" />
              Download All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        {!isSettled && (
          <div className="space-y-1.5">
            <Progress value={stats.progress} className="h-2" />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>
                {stats.completed + stats.failed} / {stats.total}
              </span>
              <div className="flex gap-3">
                {stats.completed > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {stats.completed} done
                  </span>
                )}
                {stats.failed > 0 && (
                  <span className="text-destructive">
                    {stats.failed} failed
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Summary badges when settled */}
        {isSettled && (
          <div className="flex gap-2">
            {stats.completed > 0 && (
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                {stats.completed} completed
              </Badge>
            )}
            {stats.failed > 0 && (
              <Badge variant="destructive">{stats.failed} failed</Badge>
            )}
          </div>
        )}

        {/* Entry table */}
        <div className="max-h-96 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Length</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entryStatuses.map((entry, i) => {
                const histEntry = entry.jobId
                  ? jobHistoryEntries.find((e) => e.id === entry.jobId)
                  : null
                const processingTime =
                  histEntry?.result?.processing_time_seconds

                return (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {i + 1}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {entry.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.sequence.length.toLocaleString()}
                      {entry.sequenceType === 'dna' ? ' bp' : ' aa'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={entry.status} />
                        <span
                          className={cn(
                            'text-xs',
                            entry.status === 'completed' &&
                              'text-emerald-600 dark:text-emerald-400',
                            entry.status === 'failed' && 'text-destructive',
                          )}
                        >
                          {statusLabel(entry.status)}
                          {processingTime != null &&
                            entry.status === 'completed' &&
                            ` (${processingTime}s)`}
                        </span>
                      </div>
                      {entry.status === 'failed' && entry.error && (
                        <p className="text-destructive mt-0.5 text-[10px]">
                          {entry.error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.status === 'completed' && entry.jobId && (
                        <Link
                          href={`/design-tool?job=${entry.jobId}`}
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

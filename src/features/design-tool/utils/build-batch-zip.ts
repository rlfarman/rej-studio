import { zipSync, strToU8 } from 'fflate'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { formatFasta } from '@/lib/bio/fasta'

interface BatchResultEntry {
  name: string
  result: ProcessResult
}

function buildSummaryCsv(entries: BatchResultEntry[]): string {
  const header =
    'Name,Original Length (bp),Optimized Length (bp),5′ Length (bp),3′ Length (bp),Split Point,GC Before (%),GC After (%),Processing Time (s)'
  const rows = entries.map((e) => {
    const r = e.result
    const orig = r.original_sequence
    const opt = r.optimized_sequence
    const gcBefore =
      orig.length > 0
        ? (((orig.match(/[GC]/gi)?.length ?? 0) / orig.length) * 100).toFixed(1)
        : '—'
    const gcAfter =
      opt.length > 0
        ? (((opt.match(/[GC]/gi)?.length ?? 0) / opt.length) * 100).toFixed(1)
        : '—'
    const seq5Clean = r.seq5.replace(/\[REJ5\]/g, '')
    const seq3Clean = r.seq3.replace(/\[REJ3\]/g, '')
    return [
      `"${r.name}"`,
      orig.length,
      opt.length,
      seq5Clean.length,
      seq3Clean.length,
      r.split_point,
      gcBefore,
      gcAfter,
      r.processing_time_seconds,
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

export function downloadBatchZip(entries: BatchResultEntry[]): void {
  const files: Record<string, Uint8Array> = {}

  // Per-sequence files
  const allOptimizedFasta: string[] = []
  const all5PrimeFasta: string[] = []
  const all3PrimeFasta: string[] = []

  for (const { result } of entries) {
    const safeName = result.name.replace(/[^\w\-. ]/g, '_')
    const seq5Clean = result.seq5.replace(/\[REJ5\]/g, '')
    const seq3Clean = result.seq3.replace(/\[REJ3\]/g, '')

    allOptimizedFasta.push(
      formatFasta(`${result.name}_optimized`, result.optimized_sequence),
    )
    all5PrimeFasta.push(formatFasta(`${result.name}_5prime`, seq5Clean))
    all3PrimeFasta.push(formatFasta(`${result.name}_3prime`, seq3Clean))

    files[`sequences/${safeName}_5prime.fasta`] = strToU8(
      formatFasta(`${result.name}_5prime`, seq5Clean),
    )
    files[`sequences/${safeName}_3prime.fasta`] = strToU8(
      formatFasta(`${result.name}_3prime`, seq3Clean),
    )
    files[`sequences/${safeName}_optimized.fasta`] = strToU8(
      formatFasta(`${result.name}_optimized`, result.optimized_sequence),
    )
  }

  // Combined FASTA files
  files['all_optimized.fasta'] = strToU8(allOptimizedFasta.join('\n'))
  files['all_5prime.fasta'] = strToU8(all5PrimeFasta.join('\n'))
  files['all_3prime.fasta'] = strToU8(all3PrimeFasta.join('\n'))

  // Summary CSV
  files['summary.csv'] = strToU8(buildSummaryCsv(entries))

  const zipped = zipSync(files)
  const blob = new Blob([zipped.buffer as ArrayBuffer], {
    type: 'application/zip',
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  try {
    a.style.display = 'none'
    a.href = url
    a.download = `batch_results_${entries.length}_sequences.zip`
    document.body.appendChild(a)
    a.click()
  } finally {
    a.remove()
    URL.revokeObjectURL(url)
  }
}

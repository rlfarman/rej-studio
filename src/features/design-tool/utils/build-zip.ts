import { zipSync, strToU8 } from 'fflate'
import type { ProcessResult } from '@/features/design-tool/types/process-result'
import { buildMethodsParagraph } from '@/features/design-tool/utils/methods-paragraph'

/** Build the report text from a ProcessResult. */
function buildReportText(result: ProcessResult, optionsUsed: string): string {
  let text = `Sequence Name: ${result.name}\n`
  text += `CDS:\n${result.original_sequence}\n\n`
  text += `Options Used:\n${optionsUsed}\n\n`
  text += `Optimized Sequence (prior to splitting):\n${result.optimized_sequence}\n\n`
  text += `Objectives Summary (Before optimization):\n${result.objectives_before}\n\n`
  text += `Objectives Summary (After optimization):\n${result.objectives_after}\n`

  if (result.wggw_info) {
    text += '\nWGGW Motif Information:\n'

    for (const [siteType, info] of Object.entries(result.wggw_info)) {
      text += `\n${siteType.toUpperCase()} Site:\n`
      text += `  Position: ${info.position}\n`
      text += `  Motif: ${info.motif}\n`
      text += `  Distance from split point: ${info.distance_from_split} bp\n`
      text += `  Original codons: ${info.original_codons[0]}|${info.original_codons[1]}\n`
      text += `  New codons: ${info.new_codons[0]}|${info.new_codons[1]}\n`

      if (siteType === 'main') {
        text += `  Main Split Location: ${info.position + 2}\n`
      } else if (siteType === 'stim5') {
        text += `  Stim5 Location: ${info.position + 2}\n`
      } else if (siteType === 'stim3') {
        text += `  Stim3 Location: ${info.position + 2}\n`
      }
    }

    if (result.wggw_info.main) {
      text += `\nUsed WGGW as main split point: ${result.used_wggw_as_split}\n`
    }
  }

  text += `\nProcessing Time: ${result.processing_time_seconds}s\n`

  // The methods paragraph and the machine-readable record travel with the
  // report, so an exported result can be repeated or cited without the app.
  if (result.run_record) {
    text += `\nMethods:\n${buildMethodsParagraph(result.run_record)}\n`
    text += `\nSee ${runRecordFilename(result.name)} for the full run record.\n`
  }

  return text
}

/** What the run record is called inside the ZIP. */
function runRecordFilename(name: string): string {
  return `${name.replace(/[^\w\-. ]/g, '_')}_run_record.json`
}

/** Build the sequences text from a ProcessResult. */
function buildSequencesText(result: ProcessResult): string {
  return `5' Sequence:\n${result.seq5}\n\n3' Sequence:\n${result.seq3}`
}

/**
 * Build the ZIP client-side from an already-computed ProcessResult.
 * Mirrors the format of the original /api/py/process endpoint, plus the run
 * record, so an exported result can be repeated or cited without the app.
 */
export function buildResultsZipBytes(
  result: ProcessResult,
  optionsUsed: string,
): Uint8Array {
  const safeName = result.name.replace(/[^\w\-. ]/g, '_')

  const reportText = buildReportText(result, optionsUsed)
  const sequencesText = buildSequencesText(result)

  const files: Record<string, Uint8Array> = {
    [`${safeName}_report.txt`]: strToU8(reportText),
    [`${safeName}_sequences.txt`]: strToU8(sequencesText),
  }
  if (result.run_record) {
    files[runRecordFilename(result.name)] = strToU8(
      JSON.stringify(result.run_record, null, 2),
    )
  }

  return zipSync(files)
}

function buildResultsZip(result: ProcessResult, optionsUsed: string): Blob {
  const zipped = buildResultsZipBytes(result, optionsUsed)

  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' })
}

/** Trigger a browser download of the ZIP. */
export function downloadResultsZip(
  result: ProcessResult,
  optionsUsed: string,
): void {
  const blob = buildResultsZip(result, optionsUsed)
  const safeName = result.name.replace(/[^\w\-. ]/g, '_')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  try {
    a.style.display = 'none'
    a.href = url
    a.download = `${safeName}_results.zip`
    document.body.appendChild(a)
    a.click()
  } finally {
    a.remove()
    URL.revokeObjectURL(url)
  }
}

'use client'

import { Check, Copy, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { downloadTextFile } from '@/lib/download-file'
import type { RunRecord } from '@/features/design-tool/types/process-result'
import { buildMethodsParagraph } from '@/features/design-tool/utils/methods-paragraph'

import { designToolCopy } from '../copy'

const copy = designToolCopy.results.runRecord

interface RunRecordCardProps {
  record: RunRecord | undefined
  /** Used to name the downloaded file. */
  name: string
}

/** One fact from the record: a label and the value, already formatted. */
interface Fact {
  label: string
  value: string
}

function formatStartedAt(startedAt: string): string {
  const when = new Date(startedAt)
  // An unparseable timestamp is still a fact about the record; show it as-is
  // rather than inventing a date.
  return Number.isNaN(when.getTime()) ? startedAt : when.toISOString()
}

function formatDuration(seconds: number): string {
  return seconds < 1
    ? `${Math.round(seconds * 1000)} ms`
    : `${seconds.toFixed(2)} s`
}

/** Option values come back as JSON, so render them as JSON. */
function formatOptionValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value) ?? String(value)
}

function factsFrom(record: RunRecord): Fact[] {
  const { fields } = copy
  const facts: Fact[] = [
    { label: fields.startedAt, value: formatStartedAt(record.started_at) },
    { label: fields.duration, value: formatDuration(record.duration_seconds) },
    {
      label: fields.input,
      value: fields.inputValue(
        record.input.length.toLocaleString(),
        record.input.sha256,
      ),
    },
    { label: fields.seed, value: String(record.seed) },
    { label: fields.algorithm, value: record.versions.algorithm_sha256 },
  ]

  if (record.versions.commit) {
    facts.push({ label: fields.commit, value: record.versions.commit })
  }
  facts.push(
    { label: fields.dnachisel, value: record.versions.dnachisel },
    { label: fields.python, value: record.versions.python },
  )
  if (record.corpus_version) {
    facts.push({ label: fields.corpus, value: record.corpus_version })
  }

  return facts
}

/**
 * The run record: what this run was, in enough detail to repeat or cite it.
 *
 * Everything on screen comes from the record itself, including the methods
 * paragraph, which is a template filled from the same fields. The record is
 * offered as JSON too, because the copy on screen is for reading and the JSON
 * is what a notebook or a pipeline should keep.
 */
export function RunRecordCard({ record, name }: RunRecordCardProps) {
  const { copy: copyText, isCopied } = useCopyToClipboard()

  if (!record) {
    return <p className="text-muted-foreground text-sm">{copy.unavailable}</p>
  }

  const json = JSON.stringify(record, null, 2)
  const methods = buildMethodsParagraph(record)
  const facts = factsFrom(record)
  const options = Object.entries(record.options)

  const safeName = name.replace(/[^\w\-. ]/g, '_')

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{copy.description}</p>

      <Table>
        <TableCaption className="sr-only">{copy.tableCaption}</TableCaption>
        <TableBody>
          {facts.map((fact) => (
            <TableRow key={fact.label}>
              <TableHead scope="row" className="w-40 font-medium">
                {fact.label}
              </TableHead>
              <TableCell className="font-mono text-xs break-all">
                {fact.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {options.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">
            {copy.fields.options}{' '}
            <span className="text-muted-foreground font-normal">
              ({copy.optionsCount(options.length)})
            </span>
          </h4>
          <Table>
            <TableCaption className="sr-only">
              {copy.optionsTableCaption}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.optionName}</TableHead>
                <TableHead>{copy.optionValue}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell className="font-mono text-xs">{key}</TableCell>
                  <TableCell className="font-mono text-xs break-all">
                    {formatOptionValue(value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-sm font-medium">{copy.methodsHeading}</h4>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {methods}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={copy.copyMethodsAria}
          onClick={() =>
            void copyText(methods, 'methods', {
              successMessage: copy.copiedMethods,
            })
          }
        >
          {isCopied('methods') ? (
            <Check className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
          {copy.copyMethods}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={copy.copyRecordAria}
          onClick={() =>
            void copyText(json, 'record', {
              successMessage: copy.copiedRecord,
            })
          }
        >
          {isCopied('record') ? (
            <Check className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
          {copy.copyRecord}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={copy.downloadRecordAria}
          onClick={() => downloadTextFile(`${safeName}_run_record.json`, json)}
        >
          <Download className="size-4" />
          {copy.downloadRecord}
        </Button>
      </div>
    </div>
  )
}

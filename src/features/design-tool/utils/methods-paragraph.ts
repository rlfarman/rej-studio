import { runRecordRuntime } from '@/features/design-tool/types/backend-contract'
import type { RunRecord } from '@/features/design-tool/types/process-result'

/**
 * The run record as a methods paragraph, for pasting into a notebook or a
 * manuscript.
 *
 * This is a template, not a summary: every clause is filled from a field of
 * the record, and a field that is absent produces no clause. Nothing here
 * describes the algorithm's internals — the GC bounds, for instance, live in
 * the algorithm and not in the record, so the paragraph names the constraint
 * without quoting numbers it cannot see.
 */

/** Option keys that turn a step on, and how to say each one. */
const OBJECTIVE_PHRASES: ReadonlyArray<readonly [key: string, phrase: string]> =
  [
    ['remove_cryptic_ss', 'cryptic splice site removal'],
    ['minimize_CpGs', 'CpG minimization'],
    ['reduce_kmer_complexity', 'k-mer complexity reduction'],
    ['enforce_gc', 'GC content enforcement'],
  ] as const

/**
 * Species as a methods section writes them. The app sends `human` and `mouse`;
 * the backend's own codon tables are named `h_sapiens` and `m_musculus`, and
 * either spelling can reach a record, so both map to the binomial.
 */
const SPECIES_NAMES: Readonly<Record<string, string>> = {
  human: 'Homo sapiens',
  h_sapiens: 'Homo sapiens',
  mouse: 'Mus musculus',
  m_musculus: 'Mus musculus',
}

function isOn(options: RunRecord['options'], key: string): boolean {
  return options[key] === true
}

function joinWithAnd(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? ''
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function formatStartedAt(startedAt: string): string | null {
  const when = new Date(startedAt)
  if (Number.isNaN(when.getTime())) {
    return null
  }
  const date = when.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const time = when.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
  return `${date} at ${time} UTC`
}

function formatDuration(seconds: number): string {
  return seconds < 1
    ? `${Math.round(seconds * 1000)} ms`
    : `${seconds.toFixed(1)} s`
}

/** The optimization steps that were switched on, in the order they are listed. */
export function describeObjectives(options: RunRecord['options']): string[] {
  const steps: string[] = []

  const species = options.codon_optimize
  if (typeof species === 'string' && species) {
    const name = SPECIES_NAMES[species] ?? species
    steps.push(`codon optimization for ${name}`)
  }

  for (const [key, phrase] of OBJECTIVE_PHRASES) {
    if (isOn(options, key)) {
      steps.push(phrase)
    }
  }

  const stim5 = isOn(options, 'stim_5')
  const stim3 = isOn(options, 'stim_3')
  if (stim5 && stim3) {
    steps.push('5′ and 3′ stimulatory intron sites')
  } else if (stim5) {
    steps.push('a 5′ stimulatory intron site')
  } else if (stim3) {
    steps.push('a 3′ stimulatory intron site')
  }

  return steps
}

/** The software that ran the design, as the methods sentence names it. */
function describeSoftware(record: RunRecord): string {
  const { versions } = record
  if (runRecordRuntime(record) === 'rust') {
    const version = versions.optimizer ? ` ${versions.optimizer}` : ''
    return `the REJ Studio optimizer${version}, a Rust port of DNAChisel`
  }
  return versions.dnachisel ? `DNAChisel ${versions.dnachisel}` : 'DNAChisel'
}

export function buildMethodsParagraph(record: RunRecord): string {
  const { input, options, versions } = record
  const sentences: string[] = []

  const steps = describeObjectives(options)
  const withSteps = steps.length > 0 ? ` with ${joinWithAnd(steps)}` : ''
  sentences.push(
    `A ${input.length.toLocaleString()} nt coding sequence (SHA-256 ${input.sha256.slice(0, 12)}…) ` +
      `was optimized${withSteps} using ${describeSoftware(record)}.`,
  )

  const splitPoint = options.split_point
  if (typeof splitPoint === 'number') {
    sentences.push(
      `The sequence was split after base ${splitPoint.toLocaleString()} for RNA end-joining.`,
    )
  }

  const when = formatStartedAt(record.started_at)
  sentences.push(
    when
      ? `The run was performed on ${when} and took ${formatDuration(record.duration_seconds)}.`
      : `The run took ${formatDuration(record.duration_seconds)}.`,
  )

  sentences.push(
    `Optimization used random seed ${record.seed}; the same sequence and ` +
      `options submitted with that seed reproduce this design.`,
  )

  const provenance = [
    versions.algorithm_sha256
      ? `algorithm build ${versions.algorithm_sha256}`
      : null,
    versions.wasm_sha256
      ? `WebAssembly build ${versions.wasm_sha256.slice(0, 12)}`
      : null,
    versions.commit ? `commit ${versions.commit.slice(0, 7)}` : null,
    versions.python ? `Python ${versions.python}` : null,
    // What the deployment was serving, not where the sequence came from: the
    // record cannot tell, and a methods section must not imply it can.
    record.corpus_version
      ? `gene corpus ${record.corpus_version} loaded`
      : null,
  ].filter((part): part is string => part !== null)
  if (provenance.length > 0) {
    sentences.push(`Run provenance: ${provenance.join('; ')}.`)
  }

  return sentences.join(' ')
}

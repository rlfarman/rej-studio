import type { ReactNode } from 'react'
import {
  segmentSequence,
  type HighlightType,
  type SequenceSegment,
} from '@/lib/bio/sequence-utils'

const highlightStyles: Record<HighlightType, string> = {
  'start-codon': 'bg-success/30',
  'missing-start': 'bg-danger/30',
  'stop-codon': 'bg-success/30',
  'missing-stop': 'bg-danger/30',
  'invalid-char': 'bg-danger/45',
  'internal-stop': 'bg-danger/40',
  remainder: 'bg-warning/30',
  normal: '',
}

const highlightLabels: Record<HighlightType, string> = {
  'start-codon': 'Start codon (ATG)',
  'missing-start': 'Missing start codon — expected ATG',
  'stop-codon': 'Stop codon',
  'missing-stop': 'Missing stop codon — expected TAA, TAG, or TGA',
  'invalid-char': 'Invalid character(s)',
  'internal-stop': 'Premature stop codon in reading frame',
  remainder: 'Incomplete codon — length is not a multiple of 3',
  normal: '',
}

interface SequenceHighlightProps {
  sequence: string
}

/**
 * Characters per span in an unhighlighted run.
 *
 * Keyed by their absolute offset, so typing at the end leaves every earlier
 * chunk's key and text identical and React writes no DOM for them. Small
 * enough that one rewritten chunk is cheap, large enough that a 50,000 bp
 * sequence — the field's limit — stays a couple of hundred spans.
 */
const CHUNK_SIZE = 240

/**
 * The highlighting behind the coding-sequence field.
 *
 * It renders on every keystroke, at up to 50,000 bp, so it is plain elements
 * and nothing else. Each highlighted run used to be a `Tooltip`, which cost
 * ~35 µs of React work per run: a sequence typed out of frame has an in-frame
 * stop every few codons, so a 14.4 kb cargo came to ~3,600 highlighted runs
 * and a keystroke spent most of its time rebuilding tooltips that nobody can
 * open — this layer sits behind the textarea under `pointer-events-none` and
 * `aria-hidden`, so it is never hovered and never read. The diagnostic badges
 * under the field are what explain the colours; `title` keeps each run's
 * meaning in the markup for whoever reads it next.
 */
export function SequenceHighlight({ sequence }: SequenceHighlightProps) {
  const segments = segmentSequence(sequence)

  if (segments.length === 0) return null

  const nodes: ReactNode[] = []
  let offset = 0
  for (const segment of segments) {
    const start = offset
    offset += segment.text.length
    if (segment.type !== 'normal') {
      nodes.push(<HighlightMark key={start} segment={segment} />)
      continue
    }
    for (let i = 0; i < segment.text.length; i += CHUNK_SIZE) {
      nodes.push(
        <span key={start + i}>{segment.text.slice(i, i + CHUNK_SIZE)}</span>,
      )
    }
  }

  return <>{nodes}</>
}

function HighlightMark({ segment }: { segment: SequenceSegment }) {
  return (
    <mark
      className={`${highlightStyles[segment.type]} rounded-sm`}
      title={highlightLabels[segment.type]}
    >
      {segment.text}
    </mark>
  )
}

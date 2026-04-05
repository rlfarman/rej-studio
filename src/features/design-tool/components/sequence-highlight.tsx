'use client'

import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  segmentSequence,
  type HighlightType,
  type SequenceSegment,
} from '@/lib/bio/sequence-utils'

const highlightStyles: Record<HighlightType, string> = {
  'start-codon': 'bg-emerald-400/30 dark:bg-emerald-500/30',
  'missing-start': 'bg-red-400/30 dark:bg-red-500/30',
  'stop-codon': 'bg-emerald-400/30 dark:bg-emerald-500/30',
  'missing-stop': 'bg-red-400/30 dark:bg-red-500/30',
  'invalid-char': 'bg-red-500/40 dark:bg-red-500/50',
  'internal-stop': 'bg-red-400/40 dark:bg-red-500/40',
  remainder: 'bg-yellow-300/30 dark:bg-yellow-500/30',
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

function HighlightSpan({ segment }: { segment: SequenceSegment }) {
  const style = highlightStyles[segment.type]

  if (segment.type === 'normal') {
    return <span>{segment.text}</span>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <mark className={`${style} rounded-sm`}>{segment.text}</mark>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-xs">
        {highlightLabels[segment.type]}
      </TooltipContent>
    </Tooltip>
  )
}

interface SequenceHighlightProps {
  sequence: string
}

export function SequenceHighlight({ sequence }: SequenceHighlightProps) {
  const segments = useMemo(() => segmentSequence(sequence), [sequence])

  if (segments.length === 0) return null

  return (
    <>
      {segments.map((segment, i) => (
        <HighlightSpan key={i} segment={segment} />
      ))}
    </>
  )
}

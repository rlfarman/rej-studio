'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CircleCheck, CircleAlert, CircleMinus } from 'lucide-react'
import {
  computeGcPercent,
  hasStartCodon,
  getStopCodonStatus,
  findInvalidChars,
} from '@/lib/bio/sequence-utils'
import { toCodons, translateCodon } from '@/lib/bio/genetic-code'

// ── Types ──

type DiagStatus = 'good' | 'warn' | 'error' | 'neutral'

interface DiagCheck {
  status: DiagStatus
  label: string
  tooltip: string
}

// ── Component ──

interface DiagBadgeProps {
  status: DiagStatus
  label: string
  tooltip: string
}

export function DiagBadge({ status, label, tooltip }: DiagBadgeProps) {
  const variant = status === 'error' ? 'destructive' : 'secondary'

  const Icon =
    status === 'good'
      ? CircleCheck
      : status === 'error'
        ? CircleAlert
        : status === 'warn'
          ? CircleAlert
          : CircleMinus

  const iconColor =
    status === 'good'
      ? 'text-green-500'
      : status === 'warn'
        ? 'text-yellow-500'
        : ''

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className="gap-1 select-none">
          <Icon className={`size-3 ${iconColor}`} />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

// ── Shared diagnostic checks ──

export function lengthCheck(seq: string): DiagCheck {
  const bp = seq.length
  const aa = Math.floor(bp / 3)
  return {
    status: 'neutral',
    label: `${bp.toLocaleString()} bp / ${aa.toLocaleString()} aa`,
    tooltip: 'Sequence length in base pairs and amino acids',
  }
}

export function gcCheck(seq: string): DiagCheck {
  const gc = computeGcPercent(seq)
  const status: DiagStatus =
    gc >= 35 && gc <= 60 ? 'good' : gc >= 25 && gc <= 70 ? 'warn' : 'error'
  return {
    status,
    label: `GC ${gc.toFixed(1)}%`,
    tooltip:
      status === 'good'
        ? 'GC content is in the optimal 35–60% range.'
        : status === 'warn'
          ? 'GC content is outside the optimal 35–60% range.'
          : 'GC content is far from the optimal 35–60% range.',
  }
}

export function startCodonCheck(seq: string): DiagCheck {
  const has = hasStartCodon(seq)
  return {
    status: has ? 'good' : 'error',
    label: has ? 'Start: ATG' : 'No start codon',
    tooltip: has
      ? 'Sequence begins with ATG start codon'
      : 'Sequence does not begin with ATG. This may not be a valid CDS.',
  }
}

export function stopCodonCheck(seq: string): DiagCheck {
  const stop = getStopCodonStatus(seq)
  const upper = seq.toUpperCase()
  return {
    status:
      stop === 'present' ? 'good' : stop === 'absent' ? 'warn' : 'neutral',
    label: stop === 'present' ? `Stop: ${upper.slice(-3)}` : 'No stop codon',
    tooltip:
      stop === 'present'
        ? `Sequence ends with ${upper.slice(-3)} stop codon`
        : 'No stop codon detected at the end of the sequence',
  }
}

export function multipleOf3Check(seq: string): DiagCheck | null {
  if (seq.length % 3 === 0) return null
  return {
    status: 'error',
    label: 'Not multiple of 3',
    tooltip:
      'Sequence length must be a multiple of 3 for valid codon reading frame',
  }
}

export function invalidCharsCheck(seq: string): DiagCheck | null {
  const chars = findInvalidChars(seq)
  if (chars.length === 0) return null
  return {
    status: 'error',
    label: `${chars.length} invalid char${chars.length > 1 ? 's' : ''}`,
    tooltip: `Found invalid characters: ${chars.join(', ')}`,
  }
}

export function homopolymerCheck(seq: string): DiagCheck | null {
  // Flag runs of ≥8 identical bases — synthesis vendors often reject these
  // and they create ambiguous regions for repeat-based optimizers.
  const match = seq.toUpperCase().match(/([ACGT])\1{7,}/)
  if (!match) return null
  const base = match[1]
  const runLength = match[0].length
  const position = (match.index ?? 0) + 1
  return {
    status: 'warn',
    label: `${base}×${runLength} run at bp ${position}`,
    tooltip: `Found a run of ${runLength} ${base}'s starting at bp ${position}. Homopolymer runs ≥8 bp are hard to synthesize and may be rejected by synthesis vendors.`,
  }
}

export function tandemRepeatCheck(seq: string): DiagCheck | null {
  // Flag direct tandem repeats ≥12 bp (a 6+ bp unit repeated 2+ times).
  // Keeps the regex bounded to avoid O(n²) blowup on long sequences.
  const upper = seq.toUpperCase()
  const match = upper.match(/([ACGT]{6,12})\1/)
  if (!match) return null
  const unit = match[1]
  const position = (match.index ?? 0) + 1
  return {
    status: 'warn',
    label: `Tandem repeat at bp ${position}`,
    tooltip: `Direct repeat of "${unit}" (${match[0].length} bp) starting at bp ${position}. Tandem repeats complicate synthesis and can trigger recombination.`,
  }
}

export function prematureStopCheck(seq: string): DiagCheck | null {
  // Only meaningful for in-frame sequences with at least 2 codons.
  if (seq.length < 6 || seq.length % 3 !== 0) return null
  const codons = toCodons(seq)
  const positions: number[] = []
  for (let i = 0; i < codons.length - 1; i++) {
    if (translateCodon(codons[i]) === '*') {
      positions.push(i * 3 + 1)
    }
  }
  if (positions.length === 0) return null
  const firstLabel = `bp ${positions[0]}`
  return {
    status: 'error',
    label:
      positions.length === 1
        ? `Premature stop at ${firstLabel}`
        : `${positions.length} premature stops`,
    tooltip:
      positions.length === 1
        ? `In-frame stop codon at ${firstLabel} truncates the protein before the end of the sequence.`
        : `In-frame stop codons at bp ${positions.slice(0, 3).join(', ')}${positions.length > 3 ? '…' : ''}. These truncate the protein before the end of the sequence.`,
  }
}

export function shortCdsCheck(seq: string): DiagCheck | null {
  const len = seq.length
  if (len < 6 || len >= 300) return null
  return {
    status: 'warn',
    label: `Short CDS (${len} bp)`,
    tooltip: `CDS is only ${len} bp. Sequences under 300 bp may not benefit from dual-AAV REJ splitting.`,
  }
}

function aavFitCheck(bpLength: number): DiagCheck {
  const fits = bpLength <= 4700
  return {
    status: fits ? 'good' : 'warn',
    label: fits ? 'Fits AAV' : 'Over AAV limit',
    tooltip: fits
      ? 'CDS fits within a single AAV cargo limit (~4.7 kb including ITRs, promoter, poly-A and any regulatory elements)'
      : 'CDS exceeds the ~4.7 kb AAV cargo limit — will require dual-AAV splitting',
  }
}

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
} from '@/lib/sequence-utils'

// ── Types ──

export type DiagStatus = 'good' | 'warn' | 'error' | 'neutral'

export interface DiagCheck {
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

export function aavFitCheck(bpLength: number): DiagCheck {
  const fits = bpLength <= 4700
  return {
    status: fits ? 'good' : 'warn',
    label: fits ? 'Fits AAV' : 'Exceeds AAV',
    tooltip: fits
      ? 'CDS fits within single AAV packaging limit (~4,700 bp)'
      : 'CDS exceeds single AAV packaging limit (~4,700 bp) — will require dual-AAV splitting',
  }
}

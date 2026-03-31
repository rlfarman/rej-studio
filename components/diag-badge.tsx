'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CircleCheck, CircleAlert, CircleMinus } from 'lucide-react'

export type DiagStatus = 'good' | 'warn' | 'error' | 'neutral'

interface DiagBadgeProps {
  status: DiagStatus
  label: string
  tooltip: string
}

export function DiagBadge({ status, label, tooltip }: DiagBadgeProps) {
  const variant =
    status === 'good'
      ? 'secondary'
      : status === 'error'
        ? 'destructive'
        : 'outline'

  const Icon =
    status === 'good'
      ? CircleCheck
      : status === 'error'
        ? CircleAlert
        : status === 'warn'
          ? CircleAlert
          : CircleMinus

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className="gap-1 select-none">
          <Icon className="size-3" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-56">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

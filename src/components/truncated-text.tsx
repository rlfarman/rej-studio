'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

interface TruncatedTextProps {
  children: ReactNode
  tooltip: string
  className?: string
}

export function TruncatedText({
  children,
  tooltip,
  className,
}: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  const handleMouseEnter = useCallback(() => {
    const el = ref.current
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth)
    }
  }, [])

  return (
    <Tooltip open={isTruncated ? undefined : false}>
      <TooltipTrigger asChild>
        <span ref={ref} className={className} onMouseEnter={handleMouseEnter}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

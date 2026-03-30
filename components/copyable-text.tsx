'use client'
import { useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CopyableTextProps {
  /** Accessible label */
  label: string
  /** Whether this instance is currently showing the "copied" state */
  copied: boolean
  /** Callback to trigger the copy */
  onCopy: () => void
  children: React.ReactNode
}

export function CopyableText({
  label,
  copied,
  onCopy,
  children,
}: CopyableTextProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <Tooltip open={copied || hovered}>
      <TooltipTrigger asChild>
        <button
          className="hover:text-muted-foreground inline-flex items-center hover:underline"
          onClick={onCopy}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          aria-label={label}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : 'Click to copy'}</TooltipContent>
    </Tooltip>
  )
}

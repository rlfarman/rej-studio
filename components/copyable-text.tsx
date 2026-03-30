'use client'
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="hover:text-muted-foreground inline-flex items-center hover:underline"
          onClick={onCopy}
          aria-label={label}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : 'Click to copy'}</TooltipContent>
    </Tooltip>
  )
}

'use client'
import { Check } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { popSpring } from '@/lib/motion'

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
          className="hover:text-muted-foreground inline-flex items-center gap-1.5 hover:underline"
          onClick={onCopy}
          aria-label={label}
        >
          {children}
          <AnimatePresence>
            {copied && (
              <m.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={popSpring}
              >
                <Check className="text-chart-2 size-3.5" />
              </m.span>
            )}
          </AnimatePresence>
        </button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : 'Click to copy'}</TooltipContent>
    </Tooltip>
  )
}

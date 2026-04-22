'use client'
import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface HelpLinkProps {
  /** Target href for the docs page or anchor. */
  href: string
  /**
   * Short name of the thing being explained — used for the accessible label
   * and the hover tooltip. Keep it 1–4 words (e.g. "cryptic splice removal").
   */
  topic: string
  className?: string
}

export function HelpLink({ href, topic, className }: HelpLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open docs for ${topic} (opens in new tab)`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
            className,
          )}
        >
          <CircleHelp className="size-4" aria-hidden />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        Docs: {topic} ↗
      </TooltipContent>
    </Tooltip>
  )
}

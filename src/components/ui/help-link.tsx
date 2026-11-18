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
      <TooltipTrigger
        render={
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open docs for ${topic} (opens in new tab)`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
              className,
            )}
          />
        }
      >
        <CircleHelp className="size-4" aria-hidden />
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        Docs: {topic} ↗
      </TooltipContent>
    </Tooltip>
  )
}

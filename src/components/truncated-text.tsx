import { useRef, useState, type ReactNode } from 'react'
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

  const handleMouseEnter = () => {
    const el = ref.current
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth)
    }
  }

  return (
    <Tooltip open={isTruncated ? undefined : false}>
      <TooltipTrigger
        render={
          <span
            ref={ref}
            className={className}
            onMouseEnter={handleMouseEnter}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

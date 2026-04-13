import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HelpLinkProps {
  href: string
  label: string
  className?: string
}

export function HelpLink({ href, label, className }: HelpLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-sm p-1 transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
        className,
      )}
    >
      <CircleHelp className="size-3.5" aria-hidden />
    </Link>
  )
}

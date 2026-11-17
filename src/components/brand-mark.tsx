import { Link } from '@tanstack/react-router'
import { Dna } from 'lucide-react'

import { commonCopy } from '@/copy/common'
import { cn } from '@/lib/utils'

/**
 * The REJ Studio mark: the DNA glyph on the signature lime tile, plus the
 * serif wordmark. Lime (`spark`) is reserved for this mark and molecular
 * motifs, so it reads as identity rather than as an action or a state.
 */
export function BrandMark({
  className,
  showWordmark = true,
}: {
  className?: string
  showWordmark?: boolean
}) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex items-center gap-2 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-xl bg-spark text-spark-foreground"
      >
        <Dna className="size-4" />
      </span>
      <span
        className={cn(
          'font-display text-base font-semibold tracking-tight',
          !showWordmark && 'sr-only',
        )}
      >
        {commonCopy.brandName}
      </span>
    </Link>
  )
}

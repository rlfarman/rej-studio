import { FlaskConical } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { appCopy } from '@/copy/app'
import { SAMPLE_GENE_COUNT } from '@/features/gene-search/corpus/gene-data-url'

/**
 * Says plainly that this build serves the sample gene set.
 *
 * Its grid column is a `1fr` beside the centred header search, so the label
 * is hidden on phones and the chip shrinks to its icon: spelled out it ran
 * over the search button at 390px, leaving both unreadable. The full text
 * stays the accessible name, and the tooltip explains either way.
 */
export function SampleDataBadge() {
  const label = appCopy.sampleData.label(SAMPLE_GENE_COUNT)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            tabIndex={0}
            aria-label={label}
            className="min-w-0 shrink border-warning/40 bg-warning/15 text-warning-soft"
          />
        }
      >
        <FlaskConical aria-hidden />
        <span className="hidden truncate sm:inline">{label}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {appCopy.sampleData.detail(SAMPLE_GENE_COUNT)}
      </TooltipContent>
    </Tooltip>
  )
}

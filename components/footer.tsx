'use client'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

const CITATION = `Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N, Kramer S, Lettieri K, Pfaff SL
A combinatorial system for gene expression using RNA-fragment end joining (REJ). In preparation. (2025)`

export function Footer() {
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })
  const copied = isCopied()
  const [hovered, setHovered] = useState(false)

  return (
    <footer className="mx-auto mt-auto max-w-4xl px-4 pt-4 pb-6 text-center sm:px-6 lg:px-4">
      <Tooltip open={copied || hovered}>
        <TooltipTrigger asChild>
          <button
            onClick={() => copy(CITATION)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            aria-label="Copy citation to clipboard"
            className="text-muted-foreground text-sm hover:underline"
          >
            <span className="block text-xs sm:text-sm">
              Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N,
              Kramer S, Lettieri K, Pfaff SL.
            </span>
            <span className="mt-1 block text-xs sm:text-sm">
              A combinatorial system for gene expression using RNA-fragment end
              joining (REJ). In preparation. (2025)
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {copied ? 'Copied!' : 'Click to copy the citation to your clipboard.'}
        </TooltipContent>
      </Tooltip>
    </footer>
  )
}

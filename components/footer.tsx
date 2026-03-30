'use client'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Check } from 'lucide-react'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { AnimatePresence, m } from 'motion/react'
import { popSpring } from '@/lib/motion'

const CITATION = `Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N, Kramer S, Lettieri K, Pfaff SL
A combinatorial system for gene expression using RNA-fragment end joining (REJ). In preparation. (2025)`

export function Footer() {
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })
  const copied = isCopied()

  return (
    <footer className="mx-auto mt-auto max-w-4xl px-4 pt-4 pb-6 text-center sm:px-6 lg:px-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => copy(CITATION)}
            aria-label="Copy citation to clipboard"
            className="text-muted-foreground inline-flex items-center gap-2 text-sm hover:underline"
          >
            <span>
              <span className="block text-xs sm:text-sm">
                Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N,
                Kramer S, Lettieri K, Pfaff SL.
              </span>
              <span className="mt-1 block text-xs sm:text-sm">
                A combinatorial system for gene expression using RNA-fragment end
                joining (REJ). In preparation. (2025)
              </span>
            </span>
            <AnimatePresence>
              {copied && (
                <m.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={popSpring}
                  className="shrink-0"
                >
                  <Check className="text-chart-2 size-4" />
                </m.span>
              )}
            </AnimatePresence>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {copied ? 'Copied!' : 'Click to copy the citation to your clipboard.'}
        </TooltipContent>
      </Tooltip>
    </footer>
  )
}

'use client'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Check } from 'lucide-react'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { AnimatePresence, motion } from 'motion/react'

const CITATION = `Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N, Kramer S, Lettieri K, Pfaff SL
A combinatorial system for gene expression using RNA-fragment end joining (REJ). In preparation. (2025)`

export function Footer() {
  const { copy, isCopied } = useCopyToClipboard({
    successMessage: 'Citation copied to clipboard!',
    errorMessage: 'Failed to copy citation to clipboard.',
  })

  const copied = isCopied()

  return (
    <footer className="mx-auto mt-auto max-w-4xl px-4 pt-4 pb-6 text-center sm:px-6 lg:px-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => copy(CITATION)}
            aria-label="Copy citation to clipboard"
            className="text-muted-foreground flex-col text-sm hover:underline"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="copied"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-chart-2 inline-flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <Check className="size-3.5" />
                  Citation copied
                </motion.span>
              ) : (
                <motion.span
                  key="citation"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className="block text-xs sm:text-sm">
                    Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N,
                    Kramer S, Lettieri K, Pfaff SL.
                  </span>
                  <span className="mt-1 block text-xs sm:text-sm">
                    A combinatorial system for gene expression using RNA-fragment end
                    joining (REJ). In preparation. (2025)
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Click to copy the citation to your clipboard.
        </TooltipContent>
      </Tooltip>
    </footer>
  )
}

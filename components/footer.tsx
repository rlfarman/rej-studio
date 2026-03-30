'use client'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { toast } from 'sonner'
import { Check } from 'lucide-react'

export function Footer() {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    const text = `Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N, Kramer S, Lettieri K, Pfaff SL
A combinatorial system for gene expression using RNA-fragment end joining (REJ). In preparation. (2025)`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Citation copied to clipboard!')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Failed to copy citation to clipboard.')
    }
  }

  return (
    <footer className="mx-auto mt-auto max-w-4xl px-4 pt-4 pb-6 text-center sm:px-6 lg:px-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            aria-label="Copy citation to clipboard"
            className="text-muted-foreground flex-col text-sm transition-opacity hover:underline"
          >
            {copied ? (
              <span className="text-chart-2 inline-flex items-center gap-1.5 text-xs sm:text-sm">
                <Check className="size-3.5" />
                Citation copied
              </span>
            ) : (
              <>
                <span className="block text-xs sm:text-sm">
                  Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N,
                  Kramer S, Lettieri K, Pfaff SL.
                </span>
                <span className="mt-1 block text-xs sm:text-sm">
                  A combinatorial system for gene expression using RNA-fragment end
                  joining (REJ). In preparation. (2025)
                </span>
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Click to copy the citation to your clipboard.
        </TooltipContent>
      </Tooltip>
    </footer>
  )
}

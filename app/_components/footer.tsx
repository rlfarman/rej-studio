'use client'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@radix-ui/react-tooltip'
import { TooltipContent, TooltipTrigger } from './ui/tooltip'
import { toast } from 'sonner'

export function Footer() {
  const handleClick = () => {
    const text = `Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N, Kramer S, Lettieri K, Pfaff SL
A combinatorial system for gene expression using RNA-fragment end joining (REJ). In preparation. (2025)`
    navigator.clipboard.writeText(text)
    toast.success('Citation copied to clipboard!')
  }

  return (
    <footer className="mx-auto mt-auto max-w-4xl px-4 pb-6 pt-4 text-center sm:px-6 lg:px-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className="text-muted-foreground flex-col text-sm hover:underline"
          >
            <p className="text-xs group-hover:underline">
              Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N,
              Kramer S, Lettieri K, Pfaff SL.
            </p>
            <p className="mt-1 text-sm group-hover:underline">
              A combinatorial system for gene expression using RNA-fragment end
              joining (REJ). In preparation. (2025)
            </p>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Click to copy the citation to your clipboard.
        </TooltipContent>
      </Tooltip>
    </footer>
  )
}

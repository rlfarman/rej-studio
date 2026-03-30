'use client'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { toast } from 'sonner'

export function Footer() {
  const handleClick = () => {
    const text = `Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N, Kramer S, Lettieri K, Pfaff SL
A combinatorial system for gene expression using RNA-fragment end joining (REJ). In preparation. (2025)`
    navigator.clipboard.writeText(text)
    toast.success('Citation copied to clipboard!')
  }

  return (
    <footer className="mx-auto mt-auto max-w-4xl px-4 pt-4 pb-6 text-center sm:px-6 lg:px-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className="text-muted-foreground flex-col text-sm hover:underline"
          >
            <span className="block text-[0.5rem] group-hover:underline sm:text-xs">
              Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N,
              Kramer S, Lettieri K, Pfaff SL.
            </span>
            <span className="mt-1 block text-[0.5rem] group-hover:underline sm:text-sm">
              A combinatorial system for gene expression using RNA-fragment end
              joining (REJ). In preparation. (2025)
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Click to copy the citation to your clipboard.
        </TooltipContent>
      </Tooltip>
    </footer>
  )
}

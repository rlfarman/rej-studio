'use client'
import { useState } from 'react'
import Image from 'next/image'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

const CITATION = `Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N, Kramer S, Lettieri K, Pfaff SL
A combinatorial system for gene expression using RNA-fragment end joining (REJ). In preparation. (2026)`

export function Footer() {
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })
  const copied = isCopied()
  const [hovered, setHovered] = useState(false)

  return (
    <footer className="mx-auto mt-auto w-full max-w-4xl px-4 pt-4 pb-6 sm:px-6 lg:px-4">
      <div className="flex items-center justify-between gap-4">
        <a
          href="https://www.salk.edu"
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-50 transition-opacity hover:opacity-80"
        >
          <Image
            src="/branding/SalkLogo-WCB-K.png"
            alt="Salk Institute"
            width={60}
            height={40}
            className="block dark:hidden"
          />
          <Image
            src="/branding/SalkLogo-WCB-W.png"
            alt="Salk Institute"
            width={60}
            height={40}
            className="hidden dark:block"
          />
        </a>
        <Tooltip open={copied || hovered}>
          <TooltipTrigger asChild>
            <button
              onClick={() => copy(CITATION)}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              title="Copy citation to clipboard"
              className="text-muted-foreground text-right text-xs opacity-50 transition-opacity hover:underline hover:opacity-80 sm:text-sm"
            >
              Bachmann et al. (2026) — RNA-fragment end joining (REJ)
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {copied
              ? 'Copied!'
              : 'Click to copy the citation to your clipboard.'}
          </TooltipContent>
        </Tooltip>
      </div>
    </footer>
  )
}

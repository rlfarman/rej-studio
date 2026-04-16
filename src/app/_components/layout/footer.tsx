'use client'
import { useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { appCopy } from '@/lib/copy'

export function Footer() {
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })
  const copied = isCopied()
  const [hovered, setHovered] = useState(false)

  return (
    <footer className="mx-auto mt-auto w-full max-w-4xl px-4 pt-4 pb-6 sm:px-6 lg:px-4">
      <Tooltip open={copied || hovered}>
        <TooltipTrigger asChild>
          <button
            onClick={() => copy(appCopy.footer.citationFull)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            title={appCopy.footer.copyTitle}
            className="text-muted-foreground w-full text-center text-xs opacity-50 transition-opacity hover:underline hover:opacity-80"
          >
            {appCopy.footer.citation}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {copied ? appCopy.footer.copied : appCopy.footer.copyPrompt}
        </TooltipContent>
      </Tooltip>
    </footer>
  )
}

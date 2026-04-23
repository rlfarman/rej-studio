'use client'
import { Check, Copy } from 'lucide-react'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

const CITATION = `Bachmann L, Hsu RH, Hermann K, Williams CE, Farman RL, Criales N, Kramer S, Lettieri K, Pfaff SL
A combinatorial system for gene expression using RNA-fragment end joining (REJ). In preparation. (2026)`

export function Footer() {
  const { copy, isCopied } = useCopyToClipboard({ showToast: false })
  const copied = isCopied()

  return (
    <footer className="mx-auto mt-auto w-full max-w-4xl px-4 pt-4 pb-6 sm:px-6">
      <button
        onClick={() => copy(CITATION)}
        title="Copy citation to clipboard"
        className={cn(
          'group text-muted-foreground hover:text-foreground decoration-muted-foreground/40 hover:decoration-foreground/80 inline-flex w-full items-center justify-center gap-1.5 text-center text-xs leading-snug text-balance underline underline-offset-4 transition-colors',
          copied && 'text-foreground decoration-foreground/80',
        )}
      >
        <span>
          Bachmann et al. (2026) — RNA-fragment end joining
          <span className="hidden sm:inline"> (REJ)</span>
        </span>
        <span
          aria-hidden
          className="relative inline-flex size-3.5 shrink-0 items-center justify-center"
        >
          <Copy
            className={cn(
              'absolute size-3.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
              copied
                ? 'scale-75 opacity-0'
                : 'scale-100 opacity-60 group-hover:opacity-100',
            )}
          />
          <Check
            className={cn(
              'text-success absolute size-3.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
              copied ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
            )}
          />
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Citation copied to clipboard.' : ''}
      </span>
    </footer>
  )
}

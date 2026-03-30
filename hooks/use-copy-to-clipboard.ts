'use client'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

interface UseCopyToClipboardOptions {
  resetDelay?: number
  successMessage?: string
  errorMessage?: string
}

export function useCopyToClipboard({
  resetDelay = 1500,
  successMessage = 'Copied to clipboard!',
  errorMessage = 'Failed to copy to clipboard.',
}: UseCopyToClipboardOptions = {}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const copy = useCallback(
    async (text: string, id = 'default') => {
      try {
        await navigator.clipboard.writeText(text)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setCopiedId(id)
        toast.success(successMessage)
        timeoutRef.current = setTimeout(() => setCopiedId(null), resetDelay)
      } catch {
        toast.error(errorMessage)
      }
    },
    [resetDelay, successMessage, errorMessage],
  )

  const isCopied = useCallback(
    (id = 'default') => copiedId === id,
    [copiedId],
  )

  return { copy, isCopied } as const
}

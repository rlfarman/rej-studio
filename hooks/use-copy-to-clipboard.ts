'use client'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

interface UseCopyToClipboardOptions {
  /** How long the "copied" state persists (ms) */
  resetDelay?: number
  /** Set to false to suppress success toasts (useful when inline feedback is sufficient) */
  showToast?: boolean
}

interface CopyOptions {
  /** Override the success toast for this specific call */
  successMessage?: string
  /** Override the error toast for this specific call */
  errorMessage?: string
}

export function useCopyToClipboard({
  resetDelay = 1500,
  showToast = true,
}: UseCopyToClipboardOptions = {}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const copy = useCallback(
    async (text: string, id = 'default', options?: CopyOptions) => {
      try {
        await navigator.clipboard.writeText(text)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setCopiedId(id)
        if (showToast) {
          toast.success(options?.successMessage ?? 'Copied to clipboard!')
        }
        timeoutRef.current = setTimeout(() => setCopiedId(null), resetDelay)
      } catch {
        toast.error(options?.errorMessage ?? 'Failed to copy to clipboard.')
      }
    },
    [resetDelay, showToast],
  )

  const isCopied = useCallback(
    (id = 'default') => copiedId === id,
    [copiedId],
  )

  return { copy, isCopied } as const
}

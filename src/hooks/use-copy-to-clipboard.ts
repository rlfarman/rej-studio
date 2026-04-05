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
      const succeed = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setCopiedId(id)
        if (showToast) {
          toast.success(options?.successMessage ?? 'Copied to clipboard!')
        }
        timeoutRef.current = setTimeout(() => setCopiedId(null), resetDelay)
      }

      // Prefer the async clipboard API, fall back to a hidden textarea +
      // execCommand. The fallback handles browsers without clipboard
      // permission (e.g. the document isn't focused, the page isn't in a
      // secure context, or the user is on an older browser).
      try {
        await navigator.clipboard.writeText(text)
        succeed()
        return
      } catch {
        // fall through to the legacy path
      }
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.top = '0'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        const selection = document.getSelection()
        const savedRange =
          selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        if (savedRange && selection) {
          selection.removeAllRanges()
          selection.addRange(savedRange)
        }
        if (ok) {
          succeed()
          return
        }
      } catch {
        // fall through to error toast
      }
      toast.error(options?.errorMessage ?? 'Failed to copy to clipboard.')
    },
    [resetDelay, showToast],
  )

  const isCopied = useCallback((id = 'default') => copiedId === id, [copiedId])

  return { copy, isCopied } as const
}

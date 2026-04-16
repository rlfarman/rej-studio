'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCwIcon } from 'lucide-react'
import { geneSearchCopy } from '@/features/gene-search/copy'

/**
 * Client component that retries a failed server-side search by calling
 * router.refresh() to re-render the server component tree.
 */
export function SearchRetryButton() {
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs"
      onClick={() => router.refresh()}
    >
      <RefreshCwIcon className="size-3" />
      {geneSearchCopy.search.retry}
    </Button>
  )
}

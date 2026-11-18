import { createFileRoute } from '@tanstack/react-router'

import { handlePreOptimizedZip } from '@/server/pre-optimized'

/**
 * `/api/pre-optimized/<transcript id>` — an isoform's pre-optimized ZIP,
 * passed through from the package bucket as a same-origin download. Behind
 * the passcode gate; see src/server/pre-optimized.ts.
 */
export const Route = createFileRoute('/api/pre-optimized/$transcriptId')({
  server: {
    handlers: {
      GET: ({ params }) => handlePreOptimizedZip(params.transcriptId),
    },
  },
})

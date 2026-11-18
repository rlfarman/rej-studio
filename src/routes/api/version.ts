import { createFileRoute } from '@tanstack/react-router'

import { versionInfo } from '@/server/version'

/**
 * `/api/version` — which build is answering: the commit, the optimizer the
 * build runs and the corpus it points at. Public: everything in it is already
 * in the client bundle.
 */
export const Route = createFileRoute('/api/version')({
  server: {
    handlers: {
      GET: () =>
        Response.json(versionInfo(), {
          headers: { 'cache-control': 'no-store, max-age=0' },
        }),
    },
  },
})

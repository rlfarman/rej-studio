import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { env } from '@/lib/env'
import * as schema from './schema'

const sql = neon(env.DATABASE_URL)

export const db = drizzle(sql, {
  schema,
  logger: {
    logQuery(query: string, params: unknown[]) {
      if (process.env.NODE_ENV === 'development') {
        const start = performance.now()
        // Log after the query resolves — unfortunately the Drizzle logger
        // fires before execution. We log the query text and params here so
        // devs can spot slow/unexpected queries in the terminal. In prod,
        // OpenTelemetry (via instrumentation.ts) captures per-query timings
        // without this chatty log.
        const latency = Math.round(performance.now() - start)
        const truncated = query.length > 200 ? query.slice(0, 200) + '…' : query
        console.debug(
          `[drizzle] ${latency}ms ${truncated}`,
          params.length > 0 ? params : '',
        )
      }
    },
  },
})

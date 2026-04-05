import { syncReplica } from '@/drizzle/db'

// Prime the embedded libSQL replica from Turso before the app serves traffic.
// The client will continue syncing on its own interval after this initial pull.
const start = Date.now()
try {
  await syncReplica()
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[instrumentation] Turso replica synced (${elapsed}s)`)
} catch (err) {
  console.error('[instrumentation] Turso replica sync failed:', err)
}

import { syncReplica, isReplica } from '@/drizzle/db'

if (isReplica) {
  const start = Date.now()
  try {
    await syncReplica()
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`[instrumentation] Turso replica synced (${elapsed}s)`)
  } catch (err) {
    console.error('[instrumentation] Turso replica sync failed:', err)
  }
} else {
  console.log('[instrumentation] Using local SQLite database (offline mode)')
}

import { isReplica } from '@/drizzle/db'

if (isReplica) {
  console.log('[instrumentation] Using Turso embedded replica')
} else {
  console.log('[instrumentation] Using direct Turso HTTP (or local SQLite)')
}

import fs from 'fs'
import path from 'path'
import { gunzipSync } from 'zlib'

const DB_GZ_PATH = path.join(process.cwd(), 'data', 'rej-studio.db.gz')
const DB_PATH = '/tmp/rej-studio.db'

export async function register() {
  if (process.env.NODE_ENV !== 'production') return
  if (fs.existsSync(DB_PATH)) {
    const stat = fs.statSync(DB_PATH)
    console.log(
      `[instrumentation] DB already exists at ${DB_PATH} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`
    )
    return
  }

  console.log('[instrumentation] Starting SQLite decompression...')

  // Check source file
  if (!fs.existsSync(DB_GZ_PATH)) {
    console.error(`[instrumentation] ERROR: .gz file not found at ${DB_GZ_PATH}`)
    // Try to find it
    const dataDir = path.join(process.cwd(), 'data')
    if (fs.existsSync(dataDir)) {
      console.log(`[instrumentation] Contents of ${dataDir}:`, fs.readdirSync(dataDir))
    } else {
      console.error(`[instrumentation] data/ directory does not exist at ${dataDir}`)
    }
    return
  }

  const gzStat = fs.statSync(DB_GZ_PATH)
  console.log(
    `[instrumentation] Source .gz: ${DB_GZ_PATH} (${(gzStat.size / 1024 / 1024).toFixed(1)} MB)`
  )

  const start = Date.now()

  try {
    // Use synchronous gunzip to avoid any stream/async issues
    const compressed = fs.readFileSync(DB_GZ_PATH)
    console.log(`[instrumentation] Read ${(compressed.length / 1024 / 1024).toFixed(1)} MB compressed data`)

    const decompressed = gunzipSync(compressed)
    console.log(
      `[instrumentation] Decompressed to ${(decompressed.length / 1024 / 1024).toFixed(1)} MB`
    )

    fs.writeFileSync(DB_PATH, decompressed)

    // Verify written file
    const dbStat = fs.statSync(DB_PATH)
    console.log(
      `[instrumentation] Written file size: ${(dbStat.size / 1024 / 1024).toFixed(1)} MB`
    )

    // Quick sanity check - SQLite files start with "SQLite format 3\000"
    const header = Buffer.alloc(16)
    const fd = fs.openSync(DB_PATH, 'r')
    fs.readSync(fd, header, 0, 16, 0)
    fs.closeSync(fd)
    const headerStr = header.toString('utf8', 0, 15)
    console.log(`[instrumentation] DB header: "${headerStr}"`)

    if (headerStr !== 'SQLite format 3') {
      console.error('[instrumentation] ERROR: Decompressed file is NOT a valid SQLite database!')
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`[instrumentation] Database ready (${elapsed}s)`)
  } catch (err) {
    console.error('[instrumentation] Decompression failed:', err)
  }
}

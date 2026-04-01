export async function register() {
  if (process.env.NODE_ENV !== 'production') return
  if (typeof globalThis.EdgeRuntime !== 'undefined') return

  const fs = await import('fs')
  const path = await import('path')
  const zlib = await import('zlib')

  const DB_GZ_PATH = path.join(process.cwd(), 'data', 'rej-studio.db.gz')
  const DB_PATH = '/tmp/rej-studio.db'

  if (fs.existsSync(DB_PATH)) {
    const stat = fs.statSync(DB_PATH)
    console.log(
      `[instrumentation] DB already exists at ${DB_PATH} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`
    )
    return
  }

  console.log('[instrumentation] Starting SQLite decompression...')

  if (!fs.existsSync(DB_GZ_PATH)) {
    console.error(`[instrumentation] ERROR: .gz file not found at ${DB_GZ_PATH}`)
    const dataDir = path.join(process.cwd(), 'data')
    if (fs.existsSync(dataDir)) {
      console.log(`[instrumentation] Contents of ${dataDir}:`, fs.readdirSync(dataDir))
    }
    return
  }

  const gzStat = fs.statSync(DB_GZ_PATH)
  console.log(
    `[instrumentation] Source .gz: ${(gzStat.size / 1024 / 1024).toFixed(1)} MB`
  )

  const start = Date.now()

  try {
    const compressed = fs.readFileSync(DB_GZ_PATH)
    const decompressed = zlib.gunzipSync(compressed)
    console.log(
      `[instrumentation] Decompressed: ${(decompressed.length / 1024 / 1024).toFixed(1)} MB`
    )

    fs.writeFileSync(DB_PATH, decompressed)

    // Verify SQLite header
    const header = Buffer.alloc(16)
    const fd = fs.openSync(DB_PATH, 'r')
    fs.readSync(fd, header, 0, 16, 0)
    fs.closeSync(fd)
    const headerStr = header.toString('utf8', 0, 15)

    if (headerStr !== 'SQLite format 3') {
      console.error('[instrumentation] ERROR: Not a valid SQLite database!')
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`[instrumentation] Database ready (${elapsed}s)`)
  } catch (err) {
    console.error('[instrumentation] Decompression failed:', err)
  }
}

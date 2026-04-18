/**
 * CpG island detection via the Gardiner-Garden & Frommer (1987) criteria:
 * a window of at least `minLen` bp with %GC ≥ `minGC` and
 * observed/expected CpG ratio ≥ `minObsExp`.
 *
 * Obs/Exp = (#CpG * N) / (#C * #G) where N = window length.
 */

export interface CpgIsland {
  /** 0-based inclusive start (bp) */
  start: number
  /** 0-based exclusive end (bp) */
  end: number
  /** Observed / expected CpG ratio. Higher = stronger island. */
  obsExp: number
  /** GC percent (0..1) across the island. */
  gc: number
}

interface Options {
  windowSize?: number
  step?: number
  minLen?: number
  minGC?: number
  minObsExp?: number
}

export function findCpgIslands(seq: string, opts: Options = {}): CpgIsland[] {
  const {
    windowSize = 200,
    step = 1,
    minLen = 200,
    minGC = 0.5,
    minObsExp = 0.6,
  } = opts

  const upper = seq.toUpperCase()
  const n = upper.length
  if (n < minLen) return []

  // Precompute cumulative counts for O(1) window queries.
  const cumC = new Int32Array(n + 1)
  const cumG = new Int32Array(n + 1)
  const cumCpG = new Int32Array(n + 1)
  for (let i = 0; i < n; i++) {
    cumC[i + 1] = cumC[i] + (upper[i] === 'C' ? 1 : 0)
    cumG[i + 1] = cumG[i] + (upper[i] === 'G' ? 1 : 0)
    cumCpG[i + 1] =
      cumCpG[i] + (upper[i] === 'C' && upper[i + 1] === 'G' ? 1 : 0)
  }

  type Run = { start: number; end: number }
  const runs: Run[] = []
  let runStart = -1

  for (let start = 0; start + windowSize <= n; start += step) {
    const end = start + windowSize
    const c = cumC[end] - cumC[start]
    const g = cumG[end] - cumG[start]
    const cpg = cumCpG[end] - cumCpG[start]
    const gcFrac = (c + g) / windowSize
    const obsExp = c > 0 && g > 0 ? (cpg * windowSize) / (c * g) : 0

    const isIsland = gcFrac >= minGC && obsExp >= minObsExp
    if (isIsland) {
      if (runStart === -1) runStart = start
    } else if (runStart !== -1) {
      runs.push({ start: runStart, end: start + windowSize - step })
      runStart = -1
    }
  }
  if (runStart !== -1) runs.push({ start: runStart, end: n })

  // Filter runs by min length + compute final stats over the whole run.
  return runs
    .filter((r) => r.end - r.start >= minLen)
    .map((r) => {
      const c = cumC[r.end] - cumC[r.start]
      const g = cumG[r.end] - cumG[r.start]
      const cpg = cumCpG[r.end] - cumCpG[r.start]
      const len = r.end - r.start
      return {
        start: r.start,
        end: r.end,
        gc: (c + g) / len,
        obsExp: c > 0 && g > 0 ? (cpg * len) / (c * g) : 0,
      }
    })
}

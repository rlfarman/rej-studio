import type { Suitability } from '@/lib/bio/design-suitability'

/** CDS length limits used by assessDesignSuitability. */
export const AAV_CAPACITY_BP = { single: 4000, dual: 8000 } as const

interface LengthChartModel {
  /**
   * Whether the chart says anything the table doesn't. When every isoform
   * fits a single AAV, the chart is just the CDS column drawn as bars, so it
   * is hidden and the summary strip states the fit instead.
   */
  show: boolean
  /** Axis maximum in bp, fitted to the data rather than to the AAV limits. */
  scaleMax: number
  /** Capacity limits that fall inside the axis, to draw as reference lines. */
  thresholds: number[]
}

export function lengthChartModel(
  rows: readonly { length: number; suitability: Suitability }[],
): LengthChartModel {
  const maxLen = rows.reduce((m, r) => Math.max(m, r.length), 0)
  const show =
    rows.length >= 2 && rows.some((r) => r.suitability !== 'single-aav')
  // A little headroom so the longest bar doesn't touch the edge, and room
  // to show the next capacity limit just past the longest isoform.
  const nextLimit = [AAV_CAPACITY_BP.single, AAV_CAPACITY_BP.dual].find(
    (limit) => limit > maxLen,
  )
  const scaleMax = Math.max(maxLen * 1.08, nextLimit ? nextLimit * 1.04 : 0)
  const thresholds = [AAV_CAPACITY_BP.single, AAV_CAPACITY_BP.dual].filter(
    (limit) => limit < scaleMax,
  )
  return { show, scaleMax, thresholds }
}

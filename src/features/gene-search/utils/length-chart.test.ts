import { describe, expect, it } from 'vite-plus/test'
import { AAV_CDS_TIER_LIMITS } from '@/lib/bio/aav'
import { lengthChartModel } from './length-chart'

const single = (length: number) =>
  ({ length, suitability: 'single-aav' }) as const
const dual = (length: number) => ({ length, suitability: 'dual-aav' }) as const
const triple = (length: number) =>
  ({ length, suitability: 'triple-aav' }) as const

describe('lengthChartModel', () => {
  it('hides the chart when every isoform fits a single AAV', () => {
    expect(lengthChartModel([single(429), single(1233)]).show).toBe(false)
  })

  it('hides the chart for a single isoform', () => {
    expect(lengthChartModel([dual(5000)]).show).toBe(false)
  })

  it('shows the chart when isoforms span capacity tiers', () => {
    const model = lengthChartModel([
      single(AAV_CDS_TIER_LIMITS.single - 200),
      dual(AAV_CDS_TIER_LIMITS.single + 200),
    ])
    expect(model.show).toBe(true)
    // Fitted to the data plus the next limit, so both the limit it crossed
    // and the one it's approaching are visible.
    expect(model.scaleMax).toBeCloseTo(AAV_CDS_TIER_LIMITS.dual * 1.04)
    expect(model.thresholds).toEqual([
      AAV_CDS_TIER_LIMITS.single,
      AAV_CDS_TIER_LIMITS.dual,
    ])
  })

  it('draws both limits when the longest isoform needs three vectors', () => {
    const longest = AAV_CDS_TIER_LIMITS.dual * 2
    const model = lengthChartModel([single(2000), triple(longest)])
    expect(model.scaleMax).toBeCloseTo(longest * 1.08)
    expect(model.thresholds).toEqual([
      AAV_CDS_TIER_LIMITS.single,
      AAV_CDS_TIER_LIMITS.dual,
    ])
  })
})

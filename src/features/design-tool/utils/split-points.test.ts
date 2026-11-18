import { describe, expect, it } from 'vite-plus/test'

import { rescaleSplitPoints, type SplitAnchor } from './split-points'

/** Type from `from` to `to` bases one keystroke at a time. */
function type(positions: number[], from: number, to: number) {
  let anchor: SplitAnchor | null = null
  let current = positions
  const step = to > from ? 1 : -1
  for (let len = from; len !== to; len += step) {
    anchor = rescaleSplitPoints(current, len, len + step, anchor)
    current = anchor.positions
  }
  return current
}

describe('rescaleSplitPoints', () => {
  it('keeps a split typed from empty at the midpoint', () => {
    expect(type([1], 0, 110)).toEqual([55])
  })

  it('keeps each split at its relative place', () => {
    expect(type([22], 110, 220)).toEqual([44])
    expect(type([30, 60], 90, 180)).toEqual([60, 120])
  })

  it('does not walk a split while deleting', () => {
    expect(type([50], 100, 40)).toEqual([20])
  })

  it('starts from even splits after the field is cleared', () => {
    expect(rescaleSplitPoints([20], 110, 0, null).positions).toEqual([1])
    expect(type([1, 1], 0, 90)).toEqual([30, 60])
  })

  it('ignores an anchor for positions set since', () => {
    const anchor = rescaleSplitPoints([50], 100, 101, null)
    // A paste replaced the split points: rescale from them, not the anchor.
    expect(rescaleSplitPoints([10], 101, 202, anchor).positions).toEqual([20])
  })

  it('leaves positions alone when the length is unchanged', () => {
    expect(rescaleSplitPoints([7], 50, 50, null).positions).toEqual([7])
  })
})

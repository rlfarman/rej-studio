import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { RewritePick } from '../types/form-schema'
import { SpliceSliderContext } from './splice-slider-context'

/**
 * The two-split path: the picks ride along when a drag reorders the splices,
 * and a pick the caret has left still goes.
 */

vi.mock('../utils/feature-flags', () => ({ MULTI_SPLIT_ENABLED: true }))
// Reordering toasts; jsdom has no Sonner host.
vi.mock('@/lib/toast', () => ({ toast: vi.fn() }))

// 110 bases with WGGW sites at bp 10, 55 and 76.
const SEQUENCE = 'ATGAAACCCGGGTTTACGTGCA'.repeat(5)

function Harness() {
  const [positions, setPositions] = useState<number[]>([30, 80])
  const [sitePicks, setSitePicks] = useState<(number | null)[]>([null, null])
  const [rewritePicks, setRewritePicks] = useState<RewritePick[]>([])
  return (
    <>
      <output data-testid="state">
        {JSON.stringify({ positions, sitePicks })}
      </output>
      <SpliceSliderContext
        sequence={SEQUENCE}
        positions={positions}
        species="none"
        onPositionsChange={setPositions}
        sitePicks={sitePicks}
        rewritePicks={rewritePicks}
        onSitePicksChange={(update) => setSitePicks((prev) => update(prev))}
        onRewritePicksChange={(update) =>
          setRewritePicks((prev) => update(prev))
        }
      />
    </>
  )
}

function state(): { positions: number[]; sitePicks: (number | null)[] } {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}')
}

function slider() {
  return screen.getByRole('slider', { name: /splice junction position/i })
}

function activateSplice(oneBased: 1 | 2) {
  fireEvent.click(screen.getByRole('button', { name: `Splice ${oneBased}` }))
}

function pickSiteForActiveSplice() {
  // The active splice's inspector is the one whose card is highlighted; both
  // cards' nav buttons act on their own splice.
  fireEvent.click(screen.getAllByRole('button', { name: 'Next WGGW site' })[0])
}

afterEach(cleanup)

describe('two split points', () => {
  it('drops the pick of the splice whose caret moved, and keeps the other', () => {
    render(<Harness />)
    activateSplice(1)
    pickSiteForActiveSplice()
    const picked = state().sitePicks[0]
    expect(picked).not.toBeNull()

    // Move splice 2 with the keyboard: splice 1 keeps its pick.
    activateSplice(2)
    fireEvent.keyDown(slider(), { key: 'ArrowRight' })
    expect(state().sitePicks[0]).toBe(picked)

    // Move splice 1 off its site: that pick goes.
    activateSplice(1)
    fireEvent.keyDown(slider(), { key: 'ArrowRight' })
    expect(state().sitePicks[0]).toBeNull()
  })

  it('keeps each pick with its own splice when a move reorders them', () => {
    render(<Harness />)
    activateSplice(1)
    pickSiteForActiveSplice()
    expect(state()).toEqual({ positions: [55, 80], sitePicks: [55, null] })

    // Send splice 2 to the 5′ end: the positions sort, so splice 2 takes
    // slot 0 and splice 1 — pick and all — moves to slot 1.
    activateSplice(2)
    fireEvent.keyDown(slider(), { key: 'Home' })
    expect(state()).toEqual({ positions: [1, 55], sitePicks: [null, 55] })
  })
})

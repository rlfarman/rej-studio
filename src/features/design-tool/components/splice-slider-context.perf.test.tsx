import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import type { RewritePick } from '../types/form-schema'
import { SpliceSliderContext } from './splice-slider-context'

/**
 * What a full-length CDS costs the split-point editor.
 *
 * The sequence strip renders one card per codon, and every caret move
 * re-renders all of them — so the cost of a drag is the cost of the strip,
 * and the cost of the strip is its element count. BRCA2 is the largest
 * coding sequence in the gene data (10,257 bp, ~3,400 cards); at the node
 * count this test guards, dragging the caret was measured at ~500 ms per
 * pointermove in a throttled browser.
 *
 * The budgets are happy-dom's numbers, a fraction of a browser's. What
 * matters is the ratio: nodes per codon card, which is what a browser's
 * layout and React's diff both scale with. Trimming two nodes a card took
 * the strip from 40,087 nodes to 27,660 and a caret step from a 417 ms
 * median to 303 ms here. The remaining cost is the strip rendering the
 * whole CDS at once; windowing it is the real fix and is its own job.
 */

// ~10.3 kb, BRCA2's length, with a WGGW site every ~22 bases.
const BRCA2_LENGTH = 'ATGAAACCCGGGTTTACGTGCA'.repeat(466)

function Harness({ sequence }: { sequence: string }) {
  const [positions, setPositions] = useState<number[]>([
    Math.floor(sequence.length / 2),
  ])
  const [sitePicks, setSitePicks] = useState<(number | null)[]>([])
  const [rewritePicks, setRewritePicks] = useState<RewritePick[]>([])
  return (
    <SpliceSliderContext
      sequence={sequence}
      positions={positions}
      species="human"
      onPositionsChange={setPositions}
      sitePicks={sitePicks}
      rewritePicks={rewritePicks}
      onSitePicksChange={(update) => setSitePicks((prev) => update(prev))}
      onRewritePicksChange={(update) => setRewritePicks((prev) => update(prev))}
    />
  )
}

function strip(): HTMLElement {
  return screen.getByRole('group', { name: /sequence context/i })
}

function stepCaret(): void {
  act(() => {
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
  })
}

afterEach(cleanup)

describe('split-point editor at a full-length CDS', () => {
  // 8.09 nodes per card as this is written, down from 11.73 when a card
  // carried a divider span and every base a wrapper span. The budget is
  // deterministic — same sequence, same markup — so it is set just above the
  // measurement: it fails if a card grows a node again.
  it(
    'keeps the sequence strip under 8.5 nodes per codon card',
    { timeout: 30_000 },
    () => {
      render(<Harness sequence={BRCA2_LENGTH} />)
      const cards = Math.ceil(BRCA2_LENGTH.length / 3)
      const nodes = strip().querySelectorAll('*').length
      expect(nodes / cards).toBeLessThan(8.5)
      expect(nodes).toBeLessThan(30_000)
    },
  )

  // A wall-clock budget here would only be flaky in a parallel suite, so
  // the assertion is the node count again, after a caret move: the whole
  // strip re-renders on every step, and the only thing that makes that
  // affordable is the markup staying this size.
  it(
    'does not grow the strip when the caret moves',
    { timeout: 30_000 },
    () => {
      render(<Harness sequence={BRCA2_LENGTH} />)
      const before = strip().querySelectorAll('*').length
      stepCaret()
      stepCaret()
      expect(strip().querySelectorAll('*').length).toBeLessThanOrEqual(before)
    },
  )
})

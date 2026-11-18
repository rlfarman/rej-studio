import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import type { RewritePick } from '../types/form-schema'
import { wggwSitesIn } from '../utils/wggw-selection'
import { SpliceSliderContext } from './splice-slider-context'

/**
 * What the split-point editor submits must be what it shows: the caret, the
 * fragment sizes and the inspector all have to name the same cut.
 */

// 110 bases with WGGW sites at bp 10, 55 and 76.
const SEQUENCE = 'ATGAAACCCGGGTTTACGTGCA'.repeat(5)
const SITES = [10, 55, 76]

function Harness({ initialPosition = 55 }: { initialPosition?: number }) {
  const [positions, setPositions] = useState<number[]>([initialPosition])
  const [sitePicks, setSitePicks] = useState<(number | null)[]>([])
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

/** Type a bp into "Go to" and press Enter. */
function goTo(bp: number) {
  const input = screen.getByRole('textbox', {
    name: /jump to bp or search sequence/i,
  })
  fireEvent.change(input, { target: { value: String(bp) } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

function pickNextSite() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Next WGGW site' })[0])
}

afterEach(cleanup)

describe('split-point editor site picks', () => {
  it('has the sites this suite assumes', () => {
    expect(wggwSitesIn(SEQUENCE).map((site) => site.position)).toEqual(SITES)
  })

  it('drops a picked site once the caret leaves it', () => {
    render(<Harness />)
    pickNextSite()
    expect(state()).toEqual({ positions: [76], sitePicks: [76] })

    goTo(20)
    // The caret is no longer on bp 76, so the design is not cut there: the
    // pick goes and the nearest-site preselect takes over.
    expect(state()).toEqual({ positions: [20], sitePicks: [null] })
  })

  it('drops a picked site when a keyboard step leaves it', () => {
    render(<Harness />)
    pickNextSite()
    fireEvent.keyDown(slider(), { key: 'ArrowRight' })
    expect(state()).toEqual({ positions: [77], sitePicks: [null] })
  })

  it('keeps the pick when the caret is put back on the picked site', () => {
    render(<Harness />)
    pickNextSite()
    goTo(76)
    expect(state()).toEqual({ positions: [76], sitePicks: [76] })
  })

  it('names the cut, not the caret, in the readout and the fragments', () => {
    render(<Harness initialPosition={20} />)
    // bp 20 is unpicked, so the design cuts at the nearest site, bp 10.
    expect(screen.getByText('10 bp')).toBeTruthy()
    expect(screen.getByText(/^5′ · 10 bp$/)).toBeTruthy()
    expect(screen.getByText(/^3′ · 100 bp$/)).toBeTruthy()
    expect(slider().getAttribute('aria-valuetext')).toContain('cuts at bp 10')
  })
})

describe('split-point editor keyboard', () => {
  it('steps with the arrows, pages, and jumps to the ends', () => {
    render(<Harness />)
    const el = slider()

    fireEvent.keyDown(el, { key: 'ArrowRight' })
    expect(state().positions).toEqual([56])
    fireEvent.keyDown(el, { key: 'ArrowLeft' })
    expect(state().positions).toEqual([55])
    fireEvent.keyDown(el, { key: 'ArrowUp', shiftKey: true })
    expect(state().positions).toEqual([65])
    fireEvent.keyDown(el, { key: 'ArrowDown', shiftKey: true })
    expect(state().positions).toEqual([55])

    // A page is a 20th of the sequence, at least 10 bp.
    fireEvent.keyDown(el, { key: 'PageUp' })
    expect(state().positions).toEqual([65])
    fireEvent.keyDown(el, { key: 'PageDown' })
    expect(state().positions).toEqual([55])

    fireEvent.keyDown(el, { key: 'Home' })
    expect(state().positions).toEqual([1])
    fireEvent.keyDown(el, { key: 'End' })
    expect(state().positions).toEqual([SEQUENCE.length - 1])
  })

  it('keeps aria-valuenow and aria-valuetext in step', () => {
    render(<Harness />)
    fireEvent.keyDown(slider(), { key: 'ArrowRight' })
    expect(slider().getAttribute('aria-valuenow')).toBe('56')
    expect(slider().getAttribute('aria-valuetext')).toContain('bp 56')
  })

  it('leaves keys it does not own alone', () => {
    render(<Harness />)
    fireEvent.keyDown(slider(), { key: 'Tab' })
    expect(state().positions).toEqual([55])
  })
})

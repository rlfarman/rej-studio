import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import type { RewritePick } from '../types/form-schema'
import { wggwSitesIn } from '../utils/wggw-selection'
import { SpliceSliderContext } from './splice-slider-context'

/**
 * Two things a keyboard or screen-reader user has to be able to do in the
 * split-point editor: get past the candidate-site strip in a sane number of
 * keystrokes, and learn — without seeing a colour — that the fragments are
 * too large to package.
 */

// 110 bases with WGGW sites at bp 10, 55 and 76.
const SHORT = 'ATGAAACCCGGGTTTACGTGCA'.repeat(5)
// ~8.8 kb, so a mid-sequence split leaves both fragments over the ~4,000 bp
// AAV packaging limit.
const LONG = 'ATGAAACCCGGGTTTACGTGCA'.repeat(400)

function Harness({
  sequence = SHORT,
  initialPosition = 55,
}: {
  sequence?: string
  initialPosition?: number
}) {
  const [positions, setPositions] = useState<number[]>([initialPosition])
  const [sitePicks, setSitePicks] = useState<(number | null)[]>([])
  const [rewritePicks, setRewritePicks] = useState<RewritePick[]>([])
  return (
    <>
      <button type="button">After the editor</button>
      <SpliceSliderContext
        sequence={sequence}
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

function active(): HTMLElement {
  return document.activeElement as HTMLElement
}

function label(el: HTMLElement): string {
  return el.getAttribute('aria-label') ?? ''
}

function valueNow(): string {
  return screen.getByRole('slider').getAttribute('aria-valuenow') ?? ''
}

function strip() {
  return screen.getByRole('group', { name: /sequence context/i })
}

/** Every element inside the strip that Tab would stop on. */
function tabStops(): HTMLElement[] {
  return Array.from(
    strip().querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]',
    ),
  ).filter(
    (el) =>
      el.getAttribute('tabindex') !== '-1' &&
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true',
  )
}

afterEach(cleanup)

describe('candidate-site strip keyboard navigation', () => {
  it('has the sites this suite assumes', () => {
    expect(wggwSitesIn(SHORT).map((site) => site.position)).toEqual([
      10, 55, 76,
    ])
    expect(wggwSitesIn(LONG).length).toBeGreaterThan(200)
  })

  it('is a single tab stop however many candidate sites there are', () => {
    const { unmount } = render(<Harness />)
    expect(tabStops()).toHaveLength(1)
    unmount()

    render(<Harness sequence={LONG} initialPosition={4400} />)
    expect(tabStops()).toHaveLength(1)
  })

  it('puts the tab stop on the site the design is using', () => {
    render(<Harness />)
    // bp 55 is the caret, so the resolved site is the one there.
    expect(label(tabStops()[0])).toContain('bp 55')
    expect(tabStops()[0].getAttribute('aria-current')).toBe('true')
  })

  it('moves the tab stop between sites with the arrow keys', () => {
    render(<Harness />)
    const stop = tabStops()[0]
    stop.focus()

    fireEvent.keyDown(stop, { key: 'ArrowRight' })
    expect(label(active())).toContain('bp 76')
    expect(tabStops()).toHaveLength(1)
    expect(tabStops()[0]).toBe(document.activeElement)

    fireEvent.keyDown(active(), { key: 'Home' })
    expect(label(active())).toContain('bp 10')

    fireEvent.keyDown(active(), { key: 'End' })
    expect(label(active())).toContain('bp 76')
  })

  it('does not move the split point until the site is chosen', () => {
    render(<Harness />)
    const stop = tabStops()[0]
    stop.focus()
    fireEvent.keyDown(stop, { key: 'ArrowRight' })
    expect(valueNow()).toBe('55')

    fireEvent.click(active())
    expect(valueNow()).toBe('76')
  })

  it('keeps the [ and ] shortcuts working, and follows them', () => {
    render(<Harness />)
    const stop = tabStops()[0]
    stop.focus()
    // The editor arms its window shortcuts on focusin.
    fireEvent.focusIn(stop)
    fireEvent.keyDown(window, { key: '[' })
    expect(valueNow()).toBe('10')
    expect(label(tabStops()[0])).toContain('bp 10')
  })
})

describe('AAV packaging limit', () => {
  it('names the over-limit fragments in text, not only in colour', () => {
    render(<Harness sequence={LONG} initialPosition={4400} />)
    const notice = screen.getByRole('status').textContent ?? ''
    expect(notice.toLowerCase()).toContain('too large to package into one aav')
    expect(notice).toContain('5\u2032 and 3\u2032 fragments')
    expect(notice).toContain('4,000 bp AAV packaging limit')
    // Splitting further is legitimate, so Run is not blocked — but the
    // slider says so wherever focus is.
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toContain(
      '2 fragments over the ~4,000 bp',
    )
    expect(screen.getAllByText(/over limit/).length).toBeGreaterThan(0)
  })

  it('says nothing when both fragments fit', () => {
    render(<Harness />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/over limit/)).toBeNull()
  })
})

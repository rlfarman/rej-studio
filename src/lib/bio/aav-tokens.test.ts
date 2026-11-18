import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

/**
 * The AAV tiers are three options, not three grades. These tests hold that
 * in the stylesheet: a tier must not borrow a status hue (orange read as a
 * warning and green as a success, so the column scanned as a quality scale,
 * inverted), and it must not reuse a step of the magnitude ramp the identity
 * heatmap on the same page draws with.
 */
const css = readFileSync(
  // Relative to the repo root, which is where vitest runs.
  'src/styles/globals.css',
  'utf8',
)

/** Every declaration of a custom property, in source order (light, dark). */
function values(name: string): string[] {
  return [...css.matchAll(new RegExp(`--${name}:\\s*([^;]+);`, 'g'))].map(
    (match) => match[1].trim().toLowerCase(),
  )
}

const TIERS = ['aav-single', 'aav-dual', 'aav-triple']
const STATUS = ['success', 'warning', 'danger', 'destructive', 'info']
const RAMP = ['seq-1', 'seq-2', 'seq-3', 'seq-4', 'seq-5']

describe('AAV tier colors', () => {
  it('declares both modes for every tier', () => {
    for (const tier of TIERS) {
      expect(values(tier)).toHaveLength(2)
      expect(values(`${tier}-soft`)).toHaveLength(2)
    }
  })

  it('reuses no status color, in either mode', () => {
    const status = new Set(STATUS.flatMap((name) => values(name)))
    for (const tier of TIERS) {
      for (const value of values(tier)) {
        expect(status.has(value)).toBe(false)
      }
    }
  })

  it('reuses no step of the heatmap ramp, in either mode', () => {
    const ramp = new Set(RAMP.flatMap((name) => values(name)))
    for (const tier of TIERS) {
      for (const value of values(tier)) {
        expect(ramp.has(value)).toBe(false)
      }
    }
  })

  it('gives the three tiers three different colors', () => {
    for (const mode of [0, 1]) {
      const inMode = TIERS.map((tier) => values(tier)[mode])
      expect(new Set(inMode).size).toBe(3)
    }
  })
})

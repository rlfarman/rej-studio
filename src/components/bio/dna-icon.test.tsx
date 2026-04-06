import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { DnaIcon } from './dna-icon'

describe('DnaIcon', () => {
  it('renders SVG with correct viewBox', () => {
    const { container } = render(<DnaIcon />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('viewBox')).toBe('0 -8 72 72')
  })

  it('uses currentColor fill', () => {
    const { container } = render(<DnaIcon />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('fill')).toBe('currentColor')
  })

  it('is aria-hidden', () => {
    const { container } = render(<DnaIcon />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('passes className through', () => {
    const { container } = render(<DnaIcon className="size-8" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('size-8')
  })
})

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { SpeciesIcon } from './species-icon'

describe('SpeciesIcon', () => {
  it('renders for human', () => {
    const { container } = render(<SpeciesIcon species="human" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders for mouse', () => {
    const { container } = render(<SpeciesIcon species="mouse" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('renders default icon for unknown species', () => {
    const { container } = render(<SpeciesIcon species="both" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('renders default icon when no species provided', () => {
    const { container } = render(<SpeciesIcon />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('applies className', () => {
    const { container } = render(
      <SpeciesIcon species="human" className="text-red-500" />,
    )
    const svg = container.querySelector('svg')
    expect(svg?.className.baseVal || svg?.getAttribute('class')).toContain(
      'text-red-500',
    )
  })
})

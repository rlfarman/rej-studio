import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { GcSparkline } from './gc-sparkline'

describe('GcSparkline', () => {
  it('returns null for sequences shorter than 60bp', () => {
    const { container } = render(<GcSparkline sequence={'ATGC'.repeat(10)} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders SVG for sequences >= 60bp', () => {
    const seq = 'ATGCATGC'.repeat(10) // 80bp
    const { container } = render(<GcSparkline sequence={seq} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('role')).toBe('img')
  })

  it('displays GC% label', () => {
    const seq = 'GCGCGCGC'.repeat(10) // 80bp, 100% GC
    const { container } = render(<GcSparkline sequence={seq} />)
    const label = container.querySelector('span')
    expect(label?.textContent).toContain('GC')
    expect(label?.textContent).toContain('100.0%')
  })

  it('has accessible aria-label', () => {
    const seq = 'ATGCATGC'.repeat(10)
    const { container } = render(<GcSparkline sequence={seq} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-label')).toContain('GC content sparkline')
  })
})

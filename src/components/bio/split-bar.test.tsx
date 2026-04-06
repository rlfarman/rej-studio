import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { SplitBar } from './split-bar'

describe('SplitBar', () => {
  it('renders two segments', () => {
    const { container } = render(
      <SplitBar fivePrimeLength={500} threePrimeLength={500} />,
    )
    const spans = container.querySelectorAll('span')
    expect(spans).toHaveLength(2)
  })

  it('displays correct bp labels', () => {
    const { container } = render(
      <SplitBar fivePrimeLength={1500} threePrimeLength={3500} />,
    )
    const text = container.textContent
    expect(text).toContain('1,500')
    expect(text).toContain('3,500')
  })

  it('sets correct width percentage', () => {
    const { container } = render(
      <SplitBar fivePrimeLength={250} threePrimeLength={750} />,
    )
    const styledDiv = container.querySelector('[style]')
    expect(styledDiv).not.toBeNull()
    expect(styledDiv!.getAttribute('style')).toContain('25%')
  })

  it('handles zero lengths (defaults to 50%)', () => {
    const { container } = render(
      <SplitBar fivePrimeLength={0} threePrimeLength={0} />,
    )
    const styledDiv = container.querySelector('[style]')
    expect(styledDiv).not.toBeNull()
    expect(styledDiv!.getAttribute('style')).toContain('50%')
  })
})

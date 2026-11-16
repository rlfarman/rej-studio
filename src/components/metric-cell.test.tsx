import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MetricCell } from './metric-cell'

afterEach(() => cleanup())

/** The "after" value is the last tabular-nums span in the cell. */
function afterTone(container: HTMLElement) {
  const spans = container.querySelectorAll('span.font-medium')
  return spans[spans.length - 1]?.className ?? ''
}

describe('MetricCell — direction colouring', () => {
  it('colours an increase as an improvement by default', () => {
    const { container } = render(
      <MetricCell label="Score" before={-12} after={-2} />,
    )
    expect(afterTone(container)).toContain('text-success-soft')
  })

  it('colours a decrease as a regression by default', () => {
    const { container } = render(
      <MetricCell label="Score" before={-2} after={-12} />,
    )
    expect(afterTone(container)).toContain('text-danger-soft')
  })

  it('honours lowerIsBetter', () => {
    const { container } = render(
      <MetricCell label="CpG" before={40} after={10} lowerIsBetter />,
    )
    expect(afterTone(container)).toContain('text-success-soft')
  })
})

describe('MetricCell — target band', () => {
  const GC = { min: 35, max: 60 }

  // 56.9% → 70.2% used to render green purely because the number went up,
  // even though the optimizer enforces a 35–60% band.
  it('warns when the value leaves the target band, even moving "up"', () => {
    const { container } = render(
      <MetricCell label="GC" before={56.9} after={70.2} unit="%" target={GC} />,
    )
    const tone = afterTone(container)
    expect(tone).toContain('text-warning-soft')
    expect(tone).not.toContain('text-success-soft')
  })

  it('succeeds when the value is inside the band', () => {
    const { container } = render(
      <MetricCell label="GC" before={70.2} after={52.1} unit="%" target={GC} />,
    )
    expect(afterTone(container)).toContain('text-success-soft')
  })

  it('warns for an in-band → out-of-band drop too', () => {
    const { container } = render(
      <MetricCell label="GC" before={45} after={21} unit="%" target={GC} />,
    )
    expect(afterTone(container)).toContain('text-warning-soft')
  })

  it('explains an out-of-band value on hover', () => {
    const { container } = render(
      <MetricCell label="GC" before={56.9} after={70.2} unit="%" target={GC} />,
    )
    expect(container.querySelector('[title]')?.getAttribute('title')).toContain(
      '35–60%',
    )
  })

  it('applies the band with only an "after" value', () => {
    const { container } = render(
      <MetricCell label="GC" before={null} after={70.2} unit="%" target={GC} />,
    )
    expect(afterTone(container)).toContain('text-warning-soft')
  })
})

describe('MetricCell — missing data', () => {
  it('renders an em dash when both values are missing', () => {
    const { container } = render(
      <MetricCell label="GC" before={null} after={null} />,
    )
    expect(container.textContent).toContain('—')
  })

  it('renders a simple value cell unchanged', () => {
    const { container } = render(<MetricCell label="Split" value="591 bp" />)
    expect(container.textContent).toContain('591 bp')
  })
})

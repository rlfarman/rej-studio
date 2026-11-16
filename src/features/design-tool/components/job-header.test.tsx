import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { JobHeader, RunningPlaceholder } from './job-header'

afterEach(() => cleanup())

const baseProps = {
  name: 'TP53',
  sequenceLength: 1182,
  species: 'human' as const,
  onEdit: vi.fn(),
  onRerun: vi.fn(),
}

const bloom = (container: HTMLElement) =>
  container.querySelector('[class*="completion-bloom"]')

describe('JobHeader completion bloom', () => {
  it('blooms on the running → completed transition', () => {
    const { container, rerender } = render(
      <JobHeader {...baseProps} status="running" />,
    )
    expect(bloom(container)).toBeNull()
    rerender(<JobHeader {...baseProps} status="completed" />)
    expect(bloom(container)).not.toBeNull()
  })

  it('does not bloom when mounted onto an already-completed job', () => {
    const { container } = render(
      <JobHeader {...baseProps} status="completed" />,
    )
    expect(bloom(container)).toBeNull()
  })
})

describe('JobHeader metadata chips', () => {
  it('shows bp and species when the run is known', () => {
    const { container } = render(
      <JobHeader {...baseProps} status="completed" />,
    )
    expect(container.textContent).toContain('1,182 bp')
    expect(container.textContent).toContain('Human')
  })

  // An unavailable job used to read "Untitled run · 0 bp · No longer
  // available": filler for data we simply don't have.
  it('hides bp and species when there is no local record', () => {
    const { container } = render(
      <JobHeader
        {...baseProps}
        name=""
        sequenceLength={null}
        species="none"
        status="failed"
        retriable={false}
        errorMessage="No longer available"
      />,
    )
    expect(container.textContent).not.toContain('bp')
    expect(container.textContent).not.toContain('Human')
    expect(container.textContent).toContain('No longer available')
    expect(container.textContent).toContain('Untitled run')
  })
})

describe('RunningPlaceholder progress', () => {
  it('snaps to each new checkpoint and clears when progress is unknown', () => {
    const { container, rerender } = render(
      <RunningPlaceholder progress={0.4} />,
    )
    expect(container.textContent).toContain('40%')

    rerender(<RunningPlaceholder progress={0.6} />)
    expect(container.textContent).toContain('60%')

    rerender(<RunningPlaceholder />)
    expect(container.textContent).not.toMatch(/\d+%/)
  })
})

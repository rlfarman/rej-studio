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

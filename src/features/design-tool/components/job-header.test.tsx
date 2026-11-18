import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { cleanup, render, screen } from '@testing-library/react'
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

describe('the run card, for a screen reader', () => {
  // The whole card was a live region wrapping the eased percentage, so a
  // reader heard a new number several times a second for the entire run.
  it('announces the stage only, and exposes the number as a progress bar', () => {
    const { container } = render(
      <RunningPlaceholder stage="Optimizing codons" progress={0.4} />,
    )

    const live = container.querySelectorAll('[aria-live]')
    expect(live).toHaveLength(1)
    expect(live[0].textContent).toBe('Optimizing codons')
    expect(live[0].textContent).not.toMatch(/%/)

    const bar = container.querySelector('[role="progressbar"]')!
    expect(bar.getAttribute('aria-valuenow')).toBe('40')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })

  // Pressing Run unmounted the form, which dropped focus onto <body>.
  it('takes the focus the unmounted form gave up', () => {
    const { container } = render(<RunningPlaceholder progress={0.1} />)

    expect(document.activeElement).toBe(
      container.querySelector('[data-slot="card-content"]'),
    )
  })

  it('is the page heading once the form is gone', () => {
    render(<JobHeader {...baseProps} status="completed" />)

    expect(screen.getByRole('heading', { level: 1, name: 'TP53' })).toBeTruthy()
  })
})

describe('a design this device has no record of', () => {
  // "No longer available" offered an Edit button that opened a blank form.
  it('offers a new design rather than editing nothing', () => {
    render(
      <JobHeader
        {...baseProps}
        sequenceLength={null}
        status="failed"
        retriable={false}
        missing
        errorMessage="This design ran in a browser…"
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Start a new design' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Run again' })).toBeNull()
  })

  it('still offers Edit for a run whose inputs are here', () => {
    render(<JobHeader {...baseProps} status="completed" />)

    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })
})

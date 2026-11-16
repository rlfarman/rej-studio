import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

import DesignToolError from './error'

afterEach(() => cleanup())

describe('DesignToolError', () => {
  it('renders design tool error message', () => {
    const error = new Error('crash')
    const retry = vi.fn()
    const { container } = render(
      <DesignToolError error={error} retry={retry} />,
    )
    expect(container.textContent).toContain('Design tool error')
  })

  it('calls retry when Try Again is clicked', () => {
    const error = new Error('crash')
    const retry = vi.fn()
    const { getAllByText } = render(
      <DesignToolError error={error} retry={retry} />,
    )
    fireEvent.click(getAllByText('Try again')[0])
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('has a Back to Search link', () => {
    const error = new Error('crash')
    const retry = vi.fn()
    const { container } = render(
      <DesignToolError error={error} retry={retry} />,
    )
    const link = container.querySelector('a[href="/genes"]')
    expect(link).not.toBeNull()
  })
})

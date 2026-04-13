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

import SearchError from './error'

afterEach(() => cleanup())

describe('SearchError', () => {
  it('renders search-specific error message', () => {
    const error = new Error('db down')
    const reset = vi.fn()
    const { container } = render(<SearchError error={error} reset={reset} />)
    expect(container.textContent).toContain('Search unavailable')
  })

  it('calls reset when Try Again is clicked', () => {
    const error = new Error('db down')
    const reset = vi.fn()
    const { getAllByText } = render(<SearchError error={error} reset={reset} />)
    fireEvent.click(getAllByText('Try Again')[0])
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('has a Go Home link', () => {
    const error = new Error('db down')
    const reset = vi.fn()
    const { container } = render(<SearchError error={error} reset={reset} />)
    const link = container.querySelector('a[href="/"]')
    expect(link).not.toBeNull()
  })
})

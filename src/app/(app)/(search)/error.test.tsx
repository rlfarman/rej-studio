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
    const retry = vi.fn()
    const { container } = render(<SearchError error={error} retry={retry} />)
    expect(container.textContent).toContain('Search unavailable')
  })

  it('calls retry when Try Again is clicked', () => {
    const error = new Error('db down')
    const retry = vi.fn()
    const { getAllByText } = render(<SearchError error={error} retry={retry} />)
    fireEvent.click(getAllByText('Try again')[0])
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('has a Go Home link', () => {
    const error = new Error('db down')
    const retry = vi.fn()
    const { container } = render(<SearchError error={error} retry={retry} />)
    const link = container.querySelector('a[href="/"]')
    expect(link).not.toBeNull()
  })
})

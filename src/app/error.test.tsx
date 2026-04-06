import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'

// Mock Sentry dynamic import
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

import ErrorPage from './error'

afterEach(() => cleanup())

describe('ErrorPage (root)', () => {
  it('renders error message', () => {
    const error = new Error('test error')
    const reset = vi.fn()
    const { container } = render(<ErrorPage error={error} reset={reset} />)
    expect(container.textContent).toContain('Something went wrong')
  })

  it('calls reset when Try Again is clicked', () => {
    const error = new Error('test error')
    const reset = vi.fn()
    const { getAllByText } = render(<ErrorPage error={error} reset={reset} />)
    fireEvent.click(getAllByText('Try Again')[0])
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('has a Go Home link', () => {
    const error = new Error('test error')
    const reset = vi.fn()
    const { container } = render(<ErrorPage error={error} reset={reset} />)
    const link = container.querySelector('a[href="/"]')
    expect(link).not.toBeNull()
  })
})

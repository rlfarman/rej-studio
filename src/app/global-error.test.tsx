import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))
// next/font only works inside the Next compiler.
vi.mock('@/styles/fonts', () => ({ fontVariableClassName: '' }))
vi.mock('@/styles/globals.css', () => ({}))

import GlobalError from './global-error'

describe('GlobalError', () => {
  it('renders the error page and retries on Try again', () => {
    const retry = vi.fn()
    const { getAllByText, getByRole } = render(
      <GlobalError error={new Error('root layout crashed')} retry={retry} />,
      // It renders its own <html>; mount it on the document element.
      { container: document.documentElement },
    )
    expect(getByRole('heading', { level: 1 }).textContent).toContain(
      'Something went wrong',
    )
    fireEvent.click(getAllByText('Try again')[0])
    expect(retry).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[href="/"]')).not.toBeNull()
  })
})

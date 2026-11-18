import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { appCopy } from '@/copy/app'
import { MaintenanceBanner } from './maintenance-banner'

const STORAGE_KEY = 'rej-maintenance-banner-dismissed'

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

/** A browser that refuses localStorage entirely (private mode, lab policy). */
function blockStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('storage is blocked')
    },
    setItem: () => {
      throw new Error('storage is blocked')
    },
  })
}

describe('MaintenanceBanner', () => {
  it('shows the message and remembers a dismissal', () => {
    render(<MaintenanceBanner message="Down at 9pm" signature="v1" />)
    expect(screen.getByText('Down at 9pm')).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: appCopy.maintenance.dismiss }),
    )
    expect(screen.queryByText('Down at 9pm')).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('v1')
  })

  it('shows again when the notice changes', () => {
    window.localStorage.setItem(STORAGE_KEY, 'v1')
    render(<MaintenanceBanner message="Down at 10pm" signature="v2" />)
    expect(screen.getByText('Down at 10pm')).toBeTruthy()
  })

  it('stays out of the way of a notice it already dismissed', () => {
    window.localStorage.setItem(STORAGE_KEY, 'v1')
    render(<MaintenanceBanner message="Down at 9pm" signature="v1" />)
    expect(screen.queryByText('Down at 9pm')).toBeNull()
  })

  it('still renders, and still dismisses, when storage is blocked', () => {
    // The banner renders inside the app shell, so a throw here would take
    // the whole app to the root error page — while maintenance is announced.
    blockStorage()
    render(<MaintenanceBanner message="Down at 9pm" signature="v1" />)
    expect(screen.getByText('Down at 9pm')).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: appCopy.maintenance.dismiss }),
    )
    expect(screen.queryByText('Down at 9pm')).toBeNull()
  })
})

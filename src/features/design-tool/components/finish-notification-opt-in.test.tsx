import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { fireEvent, render, screen } from '@testing-library/react'
import { FinishNotificationOptIn } from './finish-notification-opt-in'

function stubNotification(permission: NotificationPermission) {
  const fake = {
    permission,
    requestPermission: vi.fn(async () => {
      fake.permission = 'granted'
      return fake.permission
    }),
  }
  vi.stubGlobal('Notification', fake)
  return fake
}

afterEach(() => vi.unstubAllGlobals())

describe('FinishNotificationOptIn', () => {
  it('asks for permission only when clicked, then hides', async () => {
    const fake = stubNotification('default')
    render(<FinishNotificationOptIn />)
    expect(fake.requestPermission).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /notify me/i }))
    expect(fake.requestPermission).toHaveBeenCalledOnce()
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: /notify me/i })).toBeNull(),
    )
  })

  it.each(['granted', 'denied'] as const)(
    'renders nothing once permission is %s',
    (permission) => {
      stubNotification(permission)
      const { container } = render(<FinishNotificationOptIn />)
      expect(container.innerHTML).toBe('')
    },
  )
})

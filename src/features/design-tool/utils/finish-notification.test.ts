import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  notificationState,
  notifyRunSettled,
  requestNotificationPermission,
  subscribeNotificationState,
} from './finish-notification'

class FakeNotification {
  static permission: NotificationPermission = 'default'
  static requestPermission = vi.fn(async () => {
    FakeNotification.permission = 'granted'
    return FakeNotification.permission
  })
  static instances: FakeNotification[] = []
  onclick: (() => void) | null = null
  close = vi.fn()
  constructor(
    public title: string,
    public options: NotificationOptions,
  ) {
    FakeNotification.instances.push(this)
  }
}

const setVisibility = (state: DocumentVisibilityState) =>
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)

const run = (onOpen = vi.fn()) => ({
  id: 'browser-1',
  title: 'Design ready',
  body: 'TP53 has finished.',
  onOpen,
})

beforeEach(() => {
  FakeNotification.permission = 'default'
  FakeNotification.instances = []
  FakeNotification.requestPermission.mockClear()
  vi.stubGlobal('Notification', FakeNotification)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('notifyRunSettled', () => {
  it('notifies when the page is hidden and permission is granted', () => {
    FakeNotification.permission = 'granted'
    setVisibility('hidden')
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
    const onOpen = vi.fn()

    notifyRunSettled(run(onOpen))

    expect(FakeNotification.instances).toHaveLength(1)
    const [n] = FakeNotification.instances
    expect(n.title).toBe('Design ready')
    expect(n.options).toMatchObject({
      body: 'TP53 has finished.',
      tag: 'browser-1',
    })

    n.onclick?.()
    expect(focus).toHaveBeenCalled()
    expect(onOpen).toHaveBeenCalled()
    expect(n.close).toHaveBeenCalled()
  })

  it('stays quiet while the page is visible', () => {
    FakeNotification.permission = 'granted'
    setVisibility('visible')
    notifyRunSettled(run())
    expect(FakeNotification.instances).toHaveLength(0)
  })

  it.each(['default', 'denied'] as const)(
    'stays quiet when permission is %s',
    (permission) => {
      FakeNotification.permission = permission
      setVisibility('hidden')
      notifyRunSettled(run())
      expect(FakeNotification.instances).toHaveLength(0)
      expect(FakeNotification.requestPermission).not.toHaveBeenCalled()
    },
  )

  it('does nothing where notifications are unsupported', () => {
    vi.stubGlobal('Notification', undefined)
    Reflect.deleteProperty(window, 'Notification')
    setVisibility('hidden')
    expect(notificationState()).toBe('unsupported')
    expect(() => notifyRunSettled(run())).not.toThrow()
  })
})

describe('requestNotificationPermission', () => {
  it('asks the browser and tells subscribers', async () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeNotificationState(onChange)

    expect(notificationState()).toBe('default')
    expect(await requestNotificationPermission()).toBe('granted')
    expect(FakeNotification.requestPermission).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalled()
    unsubscribe()
  })
})

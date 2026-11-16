// Browser notifications for designs that finish while the tab is hidden.
// Permission is only ever requested from a click (see
// FinishNotificationOptIn); nothing here prompts on its own.

export type NotificationState = NotificationPermission | 'unsupported'

const PERMISSION_EVENT = 'rej-studio:notification-permission'
const OPEN_JOB_EVENT = 'rej-studio:open-job'

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationState(): NotificationState {
  return supported() ? Notification.permission : 'unsupported'
}

/** For useSyncExternalStore: fires after a permission request settles. */
export function subscribeNotificationState(onChange: () => void) {
  window.addEventListener(PERMISSION_EVENT, onChange)
  return () => window.removeEventListener(PERMISSION_EVENT, onChange)
}

/** Call from a user gesture only. */
export async function requestNotificationPermission(): Promise<NotificationState> {
  if (!supported()) return 'unsupported'
  try {
    await Notification.requestPermission()
  } catch {
    // Old Safari only has the callback form; the state is read back below.
  }
  window.dispatchEvent(new Event(PERMISSION_EVENT))
  return Notification.permission
}

/**
 * Asks the app shell (BrowserRuns) to show a job. A notification can outlive
 * the form that started the run, so it can't hold that form's router.
 */
export function requestOpenJob(id: string) {
  window.dispatchEvent(new CustomEvent(OPEN_JOB_EVENT, { detail: id }))
}

export function subscribeOpenJob(onOpen: (id: string) => void) {
  const listener = (event: Event) => {
    const id = (event as CustomEvent<unknown>).detail
    if (typeof id === 'string') onOpen(id)
  }
  window.addEventListener(OPEN_JOB_EVENT, listener)
  return () => window.removeEventListener(OPEN_JOB_EVENT, listener)
}

interface SettledRun {
  id: string
  title: string
  body: string
  /** Brings the run into view; called after the tab is focused. */
  onOpen: () => void
}

/**
 * Shows a notification if the page is hidden and permission is granted;
 * otherwise does nothing (the person is looking at the page, or said no).
 */
export function notifyRunSettled({ id, title, body, onOpen }: SettledRun) {
  if (notificationState() !== 'granted') return
  if (document.visibilityState !== 'hidden') return
  try {
    // `tag` replaces rather than stacks a repeat for the same run.
    const notification = new Notification(title, { body, tag: id })
    notification.onclick = () => {
      window.focus()
      onOpen()
      notification.close()
    }
  } catch {
    // Chrome on Android only allows notifications from a service worker.
  }
}

'use client'

import { useSyncExternalStore } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  notificationState,
  requestNotificationPermission,
  subscribeNotificationState,
} from '@/features/design-tool/utils/finish-notification'
import { designToolCopy } from '../copy'

const copy = designToolCopy.browserRun

/**
 * A quiet "notify me" button beside Run designer. The permission prompt only
 * ever comes from this click, never on page load, and the button goes away
 * once the person has answered (either way) or the browser can't notify.
 */
export function FinishNotificationOptIn() {
  const state = useSyncExternalStore(
    subscribeNotificationState,
    notificationState,
    // Unknown on the server, so render nothing until the client knows.
    () => 'unsupported' as const,
  )
  if (state !== 'default') return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground"
      title={copy.notifyOptInHint}
      onClick={() => void requestNotificationPermission()}
    >
      <Bell className="size-3.5" />
      {copy.notifyOptIn}
    </Button>
  )
}

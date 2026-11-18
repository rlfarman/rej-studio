import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useAccount } from '@/lib/account/account'
import { openSignIn } from '@/stores/sign-in-dialog-store'
import { designToolCopy } from '../copy'

const copy = designToolCopy.cloud

interface CloudRunToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

/**
 * "Run in the cloud", beside Run designer. Off by default, and its one line
 * of copy is always visible, not behind a tooltip: it is the whole of the
 * privacy trade-off (the sequence leaves this machine), and the person has to
 * be able to read it before they tick the box.
 *
 * Cloud runs need an account. Signed out, the box stays unticked and the
 * line says so, with a way to sign in; while the account is still being
 * read (and in the prerendered page) it is simply unavailable for a moment.
 */
export function CloudRunToggle({
  checked,
  onCheckedChange,
  disabled = false,
}: CloudRunToggleProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const account = useAccount()
  const signedIn = account.status === 'signed-in'
  return (
    <div className="flex max-w-xs items-start gap-2">
      <Checkbox
        id={id}
        checked={signedIn && checked}
        disabled={disabled || !signedIn}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-describedby={hintId}
        className="mt-0.5"
      />
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="text-sm leading-none font-medium">
          {copy.toggleLabel}
        </label>
        <p id={hintId} className="text-xs text-muted-foreground">
          {account.status === 'signed-out' ? (
            <>
              {copy.signInHint}{' '}
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-0 text-xs"
                onClick={openSignIn}
              >
                {copy.signInAction}
              </Button>
            </>
          ) : account.status === 'unavailable' ? (
            copy.unavailableHint
          ) : (
            copy.toggleHint
          )}
        </p>
      </div>
    </div>
  )
}

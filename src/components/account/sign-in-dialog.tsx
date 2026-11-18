import { useId, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { accountCopy } from '@/copy/account'
import { afterAccountChange, useAccount } from '@/lib/account/account'
import { loadAuthClient } from '@/lib/account/actions'
import { toast } from '@/lib/toast'
import { useSignInDialog } from '@/stores/sign-in-dialog-store'

const copy = accountCopy.dialog
const errors = accountCopy.errors

const CODE_PATTERN = /^\d{6}$/
// The browser's own check is the real one; this only catches the empty and
// the obviously incomplete before a round trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Step = { name: 'email' } | { name: 'code'; email: string }

/** A text field from a submitted form, or '' (a file is not text). */
function field(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name)
  return typeof value === 'string' ? value : ''
}

/**
 * Signing in to an account: an emailed six-digit code, or Google where it is
 * configured. Rendered once in the app shell and opened through
 * `useSignInDialog` (the sidebar, the cloud toggle).
 *
 * The auth client loads when the dialog opens, not with the page.
 */
export function SignInDialog() {
  const open = useSignInDialog((s) => s.open)
  const setOpen = useSignInDialog((s) => s.setOpen)

  function handleOpenChange(next: boolean) {
    if (next) void loadAuthClient()
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {/* Remounted per opening: every sign-in starts at the email step. */}
        {open && <SignInFlow onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SignInFlow({ onDone }: { onDone: () => void }) {
  const account = useAccount()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>({ name: 'email' })
  const [busy, setBusy] = useState<'code' | 'verify' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const errorId = useId()
  const google = account.status === 'signed-out' && account.google

  async function sendCode(email: string) {
    setError(null)
    setNotice(null)
    if (!EMAIL_PATTERN.test(email)) {
      setError(errors.invalidEmail)
      return false
    }
    setBusy('code')
    const { sendSignInCode } = await loadAuthClient()
    const result = await sendSignInCode(email)
    setBusy(null)
    if (!result.ok) {
      setError(result.message)
      return false
    }
    return true
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = field(event.currentTarget, 'email').trim().toLowerCase()
    if (await sendCode(email)) setStep({ name: 'code', email })
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step.name !== 'code') return
    const code = field(event.currentTarget, 'code').replace(/\s+/g, '')
    setError(null)
    setNotice(null)
    if (!CODE_PATTERN.test(code)) {
      setError(errors.invalidCode)
      return
    }
    setBusy('verify')
    const { signInWithCode } = await loadAuthClient()
    const result = await signInWithCode(step.email, code)
    if (!result.ok) {
      setBusy(null)
      setError(result.message)
      return
    }
    await afterAccountChange(queryClient)
    setBusy(null)
    toast.success(accountCopy.signedIn)
    onDone()
  }

  async function handleResend() {
    if (step.name !== 'code') return
    if (await sendCode(step.email)) setNotice(copy.resent)
  }

  async function handleGoogle() {
    setError(null)
    setBusy('google')
    const { signInWithGoogle } = await loadAuthClient()
    // Back to this page afterwards. On success the client is already on its
    // way to Google, so the button stays busy.
    const result = await signInWithGoogle(
      window.location.pathname + window.location.search,
    )
    if (!result.ok) {
      setBusy(null)
      setError(result.message)
    }
  }

  const errorLine = error && (
    <p id={errorId} role="alert" className="text-sm text-destructive">
      {error}
    </p>
  )

  if (step.name === 'code') {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{copy.codeTitle}</DialogTitle>
          <DialogDescription>{copy.codeSent(step.email)}</DialogDescription>
        </DialogHeader>
        {/* Keyed per step: both forms sit in the same place, and without
            it React reuses the email field here, keeping the address. */}
        <form
          key="code"
          className="grid gap-3"
          onSubmit={handleCode}
          noValidate
        >
          <div className="grid gap-1.5">
            <Label htmlFor="sign-in-code">{copy.codeLabel}</Label>
            <Input
              id="sign-in-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              // The code is the only thing to do here.
              autoFocus
              className="h-10 text-center font-mono text-lg tracking-[0.4em]"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          {errorLine}
          {notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          )}
          <Button type="submit" size="lg" disabled={busy !== null}>
            {busy === 'verify' ? copy.verifying : copy.verify}
          </Button>
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => {
                setError(null)
                setNotice(null)
                setStep({ name: 'email' })
              }}
            >
              {copy.useAnotherEmail}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0"
              disabled={busy !== null}
              onClick={() => void handleResend()}
            >
              {busy === 'code' ? copy.sending : copy.resend}
            </Button>
          </div>
        </form>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>
      <form
        key="email"
        className="grid gap-3"
        onSubmit={handleEmail}
        noValidate
      >
        <div className="grid gap-1.5">
          <Label htmlFor="sign-in-email">{copy.emailLabel}</Label>
          <Input
            id="sign-in-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={copy.emailPlaceholder}
            // Opening the dialog is asking to type an address.
            autoFocus
            className="h-10"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        {errorLine}
        <Button type="submit" size="lg" disabled={busy !== null}>
          {busy === 'code' ? copy.sending : copy.sendCode}
        </Button>
      </form>
      {google && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {copy.or}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy !== null}
            onClick={() => void handleGoogle()}
          >
            <GoogleMark />
            {busy === 'google' ? copy.redirecting : copy.google}
          </Button>
        </>
      )}
    </>
  )
}

/** Google's "G", as its sign-in branding asks for on the button. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}

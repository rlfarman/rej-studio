import { useId, useRef, useState, type FormEvent } from 'react'
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
import {
  resumeStep,
  signInFinalFocus,
  useSignInDialog,
} from '@/stores/sign-in-dialog-store'

const copy = accountCopy.dialog
const errors = accountCopy.errors

const CODE_LENGTH = 6
const CODE_PATTERN = /^\d{6}$/
// The browser's own check is the real one; this only catches the obviously
// incomplete before a round trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Wrong codes the server allows before the code itself is spent. */
const ALLOWED_ATTEMPTS = 5

// The primitive's title is body-sized; this is the app's section-title
// scale (`type-section-title` in globals.css), as plain utilities so they
// merge over the primitive's own size and weight.
const TITLE_CLASS = 'text-lg leading-snug font-semibold tracking-tight'

type Step = { name: 'email' } | { name: 'code'; email: string }

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
      {/* No trigger to come back to, so the dialog says where focus goes. */}
      <DialogContent finalFocus={signInFinalFocus}>
        {/* Remounted per opening; where it starts is the store's to say, so
            a code already emailed is not thrown away (`resumeStep`). */}
        {open && <SignInFlow onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SignInFlow({ onDone }: { onDone: () => void }) {
  const account = useAccount()
  const queryClient = useQueryClient()
  const setProgress = useSignInDialog((s) => s.setProgress)
  // Read once, as this component mounts: where the last attempt got to.
  const [resumed] = useState(() =>
    resumeStep(useSignInDialog.getState().progress),
  )
  const [step, setStep] = useState<Step>(
    resumed.name === 'code'
      ? { name: 'code', email: resumed.email }
      : { name: 'email' },
  )
  const [email, setEmail] = useState(resumed.email)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'code' | 'verify' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Wrong codes so far. The server spends the code after five, and then
  // answers even the right one with "too many", so the fifth refusal is
  // where this has to say so.
  const [wrongCodes, setWrongCodes] = useState(0)
  const emailRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const google = account.status === 'signed-out' && account.google

  /** Says why, and puts the person back in the field they have to fix. */
  function refuse(
    message: string,
    input: HTMLInputElement | null,
    { select = false }: { select?: boolean } = {},
  ) {
    setError(message)
    input?.focus()
    if (select) input?.select()
  }

  async function sendCode(address: string) {
    setError(null)
    setNotice(null)
    if (!address) {
      refuse(errors.invalidEmail, emailRef.current)
      return false
    }
    if (!EMAIL_PATTERN.test(address)) {
      refuse(errors.notAnEmail, emailRef.current, { select: true })
      return false
    }
    setBusy('code')
    const { sendSignInCode } = await loadAuthClient()
    const result = await sendSignInCode(address)
    setBusy(null)
    if (!result.ok) {
      refuse(result.message, emailRef.current)
      return false
    }
    setCode('')
    setWrongCodes(0)
    setProgress({ email: address, codeSentAt: Date.now() })
    return true
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // The busy buttons keep their focus, so they are only `aria-disabled`
    // and still reachable: every handler turns a second press away itself.
    if (busy) return
    const address = email.trim().toLowerCase()
    setEmail(address)
    if (await sendCode(address)) setStep({ name: 'code', email: address })
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || step.name !== 'code') return
    setError(null)
    setNotice(null)
    if (!CODE_PATTERN.test(code)) {
      refuse(errors.invalidCode, codeRef.current)
      return
    }
    setBusy('verify')
    const { signInWithCode } = await loadAuthClient()
    const result = await signInWithCode(step.email, code)
    if (!result.ok) {
      setBusy(null)
      const spent =
        result.reason === 'too-many-attempts' ||
        (result.reason === 'wrong-code' && wrongCodes + 1 >= ALLOWED_ATTEMPTS)
      if (result.reason === 'wrong-code') setWrongCodes(wrongCodes + 1)
      refuse(spent ? errors.tooManyAttempts : result.message, codeRef.current, {
        select: result.reason === 'wrong-code',
      })
      return
    }
    await afterAccountChange(queryClient)
    setBusy(null)
    setProgress(null)
    toast.success(accountCopy.signedIn(step.email))
    onDone()
  }

  async function handleResend() {
    if (busy || step.name !== 'code') return
    if (await sendCode(step.email)) {
      setNotice(copy.resent)
      codeRef.current?.focus()
    }
  }

  /** Back to the address, keeping it: a typo is one character to fix. */
  function backToEmail() {
    setError(null)
    setNotice(null)
    setCode('')
    setStep({ name: 'email' })
    // The code that was sent is abandoned; the address is not.
    setProgress({ email, codeSentAt: null })
  }

  async function handleGoogle() {
    if (busy) return
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

  // Busy, but still focusable: `disabled` on the button a keyboard user has
  // just pressed sends focus to the body, and nothing in the dialog gets it
  // back. The handlers turn a second press away themselves.
  const busyProps = {
    'aria-disabled': busy !== null || undefined,
    className: 'aria-disabled:opacity-50',
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
          <DialogTitle className={TITLE_CLASS}>{copy.codeTitle}</DialogTitle>
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
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH}
              placeholder={copy.codePlaceholder}
              value={code}
              // Only the digits, so a code pasted as "123 456" is not cut
              // short by the length limit, and letters cannot be typed.
              onChange={(event) =>
                setCode(
                  event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH),
                )
              }
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
          <Button type="submit" size="lg" {...busyProps}>
            {busy === 'verify' ? copy.verifying : copy.verify}
          </Button>
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0"
              onClick={backToEmail}
            >
              {copy.useAnotherEmail}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0 aria-disabled:opacity-50"
              aria-disabled={busy !== null || undefined}
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
        <DialogTitle className={TITLE_CLASS}>{copy.title}</DialogTitle>
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
            ref={emailRef}
            type="email"
            autoComplete="email"
            placeholder={copy.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            // Opening the dialog is asking to type an address.
            autoFocus
            className="h-10"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        {errorLine}
        <Button type="submit" size="lg" {...busyProps}>
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
            {...busyProps}
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

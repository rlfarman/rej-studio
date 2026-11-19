import { create } from 'zustand'

/** How long an emailed sign-in code works for (src/server/accounts/auth.ts). */
const CODE_LIFETIME_MS = 10 * 60_000

/**
 * How far a sign-in got, kept outside the dialog so closing it does not
 * throw the progress away: a code already emailed is good for ten minutes,
 * and asking for another one spends part of a small per-address budget.
 *
 * `codeSentAt` is null once the code is abandoned ("Use another email"),
 * which keeps the address for the field while sending the dialog back to the
 * email step.
 */
export interface SignInProgress {
  email: string
  codeSentAt: number | null
}

/**
 * Whether the sign-in dialog is open, and how far the sign-in got. A store
 * rather than local state so anything can ask for it — the sidebar's "Sign
 * in", the design tool's cloud toggle — while the dialog itself is rendered
 * once, in the app shell.
 */
interface SignInDialogState {
  open: boolean
  progress: SignInProgress | null
  setOpen: (open: boolean) => void
  setProgress: (progress: SignInProgress | null) => void
}

export const useSignInDialog = create<SignInDialogState>((set) => ({
  open: false,
  progress: null,
  setOpen: (open) => set({ open }),
  setProgress: (progress) => set({ progress }),
}))

/** Where a reopened dialog starts: back on the code step while one is live. */
export function resumeStep(
  progress: SignInProgress | null,
  now = Date.now(),
): { name: 'email'; email: string } | { name: 'code'; email: string } {
  if (!progress) return { name: 'email', email: '' }
  const live =
    progress.codeSentAt !== null && now - progress.codeSentAt < CODE_LIFETIME_MS
  return { name: live ? 'code' : 'email', email: progress.email }
}

/**
 * What had focus when the dialog was opened. Not in the store's state: it is
 * a DOM node, nothing renders from it, and it must not outlive the page.
 */
let opener: HTMLElement | null = null

/** Opens the sign-in dialog, from anywhere. */
export function openSignIn(): void {
  const active = document.activeElement
  // The body having focus is nobody having focus.
  opener =
    active instanceof HTMLElement && active !== document.body ? active : null
  useSignInDialog.getState().setOpen(true)
}

/**
 * Where focus goes when the dialog closes. It is opened from here rather
 * than from a `DialogTrigger`, so Base UI has nothing of its own to return
 * to, and after a successful sign-in the button it was opened from has been
 * replaced by the account menu. In order: whatever opened it while that is
 * still in the document, then the sidebar's account entry, then the page's
 * main region (focusable for exactly this). `false` leaves it to Base UI.
 */
export function signInFinalFocus(): HTMLElement | false {
  if (opener?.isConnected) return opener
  return (
    document.querySelector<HTMLElement>('[data-account-menu]') ??
    document.getElementById('main-content') ??
    false
  )
}

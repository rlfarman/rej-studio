import { create } from 'zustand'

/**
 * Whether the sign-in dialog is open. A store rather than local state so
 * anything can ask for it — the sidebar's "Sign in", the design tool's
 * cloud toggle — while the dialog itself is rendered once, in the app shell.
 */
interface SignInDialogState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useSignInDialog = create<SignInDialogState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

/** Opens the sign-in dialog, from anywhere. */
export function openSignIn(): void {
  useSignInDialog.getState().setOpen(true)
}

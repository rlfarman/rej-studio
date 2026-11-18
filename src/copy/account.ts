/**
 * Accounts: the sign-in dialog, the sidebar's account entry, and what the
 * app says about signing in. Shared copy, because the app shell and the
 * design tool (its cloud toggle) both use it.
 */
export const accountCopy = {
  signIn: 'Sign in',
  signOut: 'Sign out',
  signedInAs: (email: string) => `Signed in as ${email}`,
  accountMenuAria: (email: string) => `Account: ${email}`,
  signedIn: 'Signed in.',
  signedOut: 'Signed out of your account.',
  signOutFailed: 'Could not sign out. Try again.',
  dialog: {
    title: 'Sign in to REJ Studio',
    description:
      'An account keeps your cloud designs on every device. Everything else works without one.',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.org',
    sendCode: 'Email me a code',
    sending: 'Sending…',
    or: 'or',
    google: 'Continue with Google',
    redirecting: 'Opening Google…',
    codeTitle: 'Check your email',
    codeSent: (email: string) =>
      `We sent a six-digit code to ${email}. It works for 10 minutes.`,
    codeLabel: 'Sign-in code',
    verify: 'Sign in',
    verifying: 'Signing in…',
    useAnotherEmail: 'Use another email',
    resend: 'Send a new code',
    resent: 'A new code is on its way.',
  },
  errors: {
    invalidEmail: 'Enter an email address.',
    invalidCode: 'Enter the six digits from the email.',
    wrongCode:
      'That code is not right, or it has expired. Try again, or send a new one.',
    tooManyAttempts: 'Too many wrong codes. Send a new one.',
    unreachable:
      'Could not reach REJ Studio. Check your connection and try again.',
    generic: 'Something went wrong signing in. Try again.',
  },
} as const

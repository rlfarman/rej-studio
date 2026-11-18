/**
 * Accounts: the sign-in dialog, the sidebar's account entry, and what the
 * app says about signing in. Shared copy, because the app shell and the
 * design tool (its cloud toggle) both use it.
 */
export const accountCopy = {
  // The sidebar entry, which sits a click away from the lab passcode page:
  // a second bare "Sign in" there read as though the passcode had failed.
  // Named for what an account adds instead (src/components/account).
  sidebarSignIn: 'Sign in for cloud designs',
  signOut: 'Sign out',
  signedInAs: (email: string) => `Signed in as ${email}`,
  accountMenuAria: (email: string) => `Account: ${email}`,
  // Says what signing in changed: the cloud checkbox goes from disabled to
  // available without a word of its own.
  signedIn: (email: string) =>
    `Signed in as ${email}. Cloud runs are now available.`,
  signedOut: 'Signed out of your account.',
  signOutFailed: 'Could not sign out. Try again.',
  // The lab passcode session ran out while this tab was open, so nothing
  // about accounts can be read until the passcode is entered again. Said
  // plainly, because the alternative is the app claiming the feature does
  // not exist on this deployment.
  locked: {
    sidebar: 'Lab session ended',
    // Keeps the visible label, and adds what pressing it does.
    sidebarAria: 'Lab session ended — reload to enter the passcode',
    hint: 'Your lab session ended. Reload the page to enter the passcode again.',
  },
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
    // Shows the shape of what goes in the empty, letter-spaced box.
    codePlaceholder: '000000',
    verify: 'Sign in',
    verifying: 'Signing in…',
    useAnotherEmail: 'Use another email',
    resend: 'Send a new code',
    resent: 'A new code is on its way.',
  },
  errors: {
    invalidEmail: 'Enter an email address.',
    notAnEmail: "That doesn't look like a full email address.",
    invalidCode: 'Enter the six digits from the email.',
    wrongCode:
      'That code is not right, or it has expired. Try again, or send a new one.',
    tooManyAttempts: 'Too many wrong codes. Send a new one.',
    unreachable:
      'Could not reach REJ Studio. Check your connection and try again.',
    generic: 'Something went wrong signing in. Try again.',
  },
} as const

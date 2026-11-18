export const authCopy = {
  // The shared lab passcode. Deliberately not "sign in": accounts are a
  // separate, optional thing (src/copy/account.ts), and calling both the
  // same read as though the passcode had failed.
  login: {
    pageTitle: 'Lab passcode',
    // Under the wordmark, for a first visit that knows nothing else yet.
    tagline: 'RNA End-Joining sequence design',
    overline: 'Pfaff Lab',
    // What a password manager files the passcode under. There is no
    // username, and without one managers save it as "no username".
    passwordManagerUsername: 'Pfaff Lab',
    title: 'Enter the lab passcode',
    description:
      'REJ Studio is private to the lab. Everyone shares one passcode; personal accounts are separate and optional.',
    passcodeLabel: 'Passcode',
    submit: 'Unlock',
    submitting: 'Unlocking…',
    wrongPasscode: 'That passcode is not right. Try again.',
    tooManyAttempts: 'Too many tries. Wait a minute, then try again.',
    // Shown only when JavaScript never runs. The same HTML is served for
    // every /login URL (src/server/prerendered-pages.ts), so this has to be
    // true of all of them: it can say what a refusal looks like, but not
    // that one happened. Plain text with no markup in it: the form renders
    // it as HTML inside <noscript>.
    noScript:
      'JavaScript is off, so this page cannot say what became of the last attempt: landing back here instead of in the app means the passcode was refused. Unlocking still works, and opens the home page.',
  },
  // Ends the passcode session (and any account session with it), so a shared
  // lab computer can be left without clearing cookies.
  lock: {
    label: 'Lock REJ Studio',
  },
} as const

export const authCopy = {
  // The shared lab passcode. Deliberately not "sign in": accounts are a
  // separate, optional thing (src/copy/account.ts), and calling both the
  // same read as though the passcode had failed.
  login: {
    pageTitle: 'Lab passcode',
    overline: 'Pfaff Lab',
    title: 'Enter the lab passcode',
    description:
      'REJ Studio is private to the lab. Everyone shares one passcode; personal accounts are separate and optional.',
    passcodeLabel: 'Passcode',
    submit: 'Unlock',
    submitting: 'Unlocking…',
    wrongPasscode: 'That passcode is not right. Try again.',
    tooManyAttempts: 'Too many tries. Wait a minute, then try again.',
  },
  // Ends the passcode session (and any account session with it), so a shared
  // lab computer can be left without clearing cookies.
  lock: {
    label: 'Lock REJ Studio',
  },
} as const

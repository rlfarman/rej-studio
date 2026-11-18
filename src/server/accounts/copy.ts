/**
 * What accounts say: the sign-in email, and the refusals the auth endpoints
 * answer with (the sign-in dialog shows `message` as it is).
 */
export const accountsCopy = {
  email: {
    fromName: 'REJ Studio',
    subject: (code: string) => `${code} is your REJ Studio sign-in code`,
    text: (code: string, minutes: number) =>
      [
        `Your REJ Studio sign-in code is ${code}.`,
        '',
        `It works once, for the next ${minutes} minutes.`,
        'If you did not ask for it, you can ignore this email: nobody can sign in without the code.',
      ].join('\n'),
    html: (code: string, minutes: number) =>
      [
        '<p>Your REJ Studio sign-in code is</p>',
        `<p style="font-size:28px;font-weight:600;letter-spacing:6px;font-family:monospace">${code}</p>`,
        `<p>It works once, for the next ${minutes} minutes.</p>`,
        '<p style="color:#666">If you did not ask for it, you can ignore this email: nobody can sign in without the code.</p>',
      ].join(''),
  },
  http: {
    unavailable: 'Accounts are not available on this deployment.',
    rateLimited:
      'Too many sign-in requests from this network. Wait a minute and try again.',
    codeLimited:
      'Too many codes sent to that address. Wait a minute and try again.',
    badRequest: 'That sign-in request could not be read.',
  },
} as const

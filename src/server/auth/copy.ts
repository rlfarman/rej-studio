/** What the passcode gate says to callers that are not signed in. */
export const authCopy = {
  signInRequired: 'Sign in with the passcode to use REJ Studio.',
  notConfigured: 'REJ Studio is not configured to accept sign-ins.',
  badRequest: 'That sign-in request could not be read.',
  crossOrigin: 'Sign-ins must come from REJ Studio itself.',
} as const

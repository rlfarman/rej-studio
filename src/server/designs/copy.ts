/**
 * What `/api/designs` and the cloud-design Workflow say: HTTP refusals, and
 * the failure messages a design carries back to whoever reads it (the design
 * tool shows them as they are, and an agent reads them through get_design).
 */

export const designsCopy = {
  http: {
    notConfigured:
      'Cloud designs are not configured on this deployment (no Cloudflare Access settings).',
    unauthorized: 'Sign in through Cloudflare Access to use cloud designs.',
    noEmail:
      'This Access token has no email, so it cannot own a design. Sign in as a person, not a service token.',
    accessUnavailable:
      'Could not check your sign-in with Cloudflare Access just now. Try again in a moment.',
    unavailable: 'Cloud designs are not available on this deployment.',
    badJson: 'The request body must be JSON.',
    bodyTooLarge: 'That request is too large.',
    invalid: (reason: string) => `That design cannot be run: ${reason}`,
    tooLong: (bases: number, limit: number) =>
      `That sequence is ${bases.toLocaleString('en-US')} bases; cloud designs take up to ${limit.toLocaleString('en-US')}. Run it in the browser instead, which has no limit.`,
    rateLimited:
      'Too many cloud designs in the last minute. Wait a minute and try again.',
    badId: 'That is not a cloud design id.',
    notFound:
      'No cloud design with that id. It may have been deleted, or passed its retention.',
    notOwner: 'Only the person who submitted a cloud design can delete it.',
    notStarted:
      'That design has not started yet, so who owns it is not known. Try again in a moment.',
    failed: 'The cloud-design request failed.',
  },

  /** Why a cloud design failed, as its reader sees it. */
  failure: {
    tooLarge:
      'Too large for the cloud — the design needed more than the 5 minutes of CPU a cloud run gets. Run it in the browser instead.',
    resultTooLarge:
      'The finished design was too large to store without a results bucket on this deployment.',
    transient:
      'The cloud run stopped before it finished. Submitting it again restarts it.',
    resultMissing:
      'The finished design’s stored result could not be read. Submitting it again re-runs it.',
    terminated: 'The cloud run was stopped before it finished.',
  },
} as const

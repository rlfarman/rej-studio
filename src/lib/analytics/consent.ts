import type { ConsentState } from './types'

/** Default consent state — all denied (cookieless). */
export const CONSENT_DEFAULTS: ConsentState = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
} as const

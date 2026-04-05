import type { AnalyticsEvent } from './types'

/**
 * Push a typed event to the GTM dataLayer. SSR-safe — silently no-ops on the
 * server. Fire-and-forget; never throws.
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(event)
}

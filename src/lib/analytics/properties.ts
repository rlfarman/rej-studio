/**
 * Push user/session properties to the GTM dataLayer so they can be read as
 * Data Layer Variables inside the GTM container. SSR-safe.
 */
export function setUserProperties(
  props: Record<string, string | undefined>,
): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event: 'user_properties', ...props })
}

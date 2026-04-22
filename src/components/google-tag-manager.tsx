import { GoogleTagManager as NextGoogleTagManager } from '@next/third-parties/google'
import Script from 'next/script'

// Google Tag Manager loader with consent mode v2 defaults.
//
// The beforeInteractive script sets all consent signals to "denied" before
// GTM evaluates any tags. Because we use cookieless analytics (no consent
// banner), consent is never upgraded — GA4 fires cookieless pings and uses
// modeled data for user-level metrics.
//
// Gated on NEXT_PUBLIC_GTM_ID so dev/preview stays clean.
//
// NOTE: Next.js applies the CSP nonce from the x-nonce header automatically.
// Browsers strip nonce attributes from the DOM after parsing (HTML spec),
// causing a dev-only hydration mismatch warning (nonce="abc" vs nonce="").
// This is a known Next.js issue and does not affect production.
export function GoogleTagManager() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID

  if (!gtmId) return null

  return (
    <>
      {/* Consent defaults must load before GTM evaluates tags — beforeInteractive is intentional. */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <Script
        id="gtm-consent-defaults"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{
  analytics_storage:'denied',
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied'
});`,
        }}
      />
      <NextGoogleTagManager gtmId={gtmId} />
    </>
  )
}

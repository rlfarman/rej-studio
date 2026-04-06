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
export function GoogleTagManager({ nonce }: { nonce?: string }) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID

  if (!gtmId) return null

  return (
    <>
      <Script
        id="gtm-consent-defaults"
        strategy="beforeInteractive"
        nonce={nonce}
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

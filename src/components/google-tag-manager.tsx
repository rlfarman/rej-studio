import { GoogleTagManager as NextGoogleTagManager } from '@next/third-parties/google'

// Google Tag Manager loader. Gated on NEXT_PUBLIC_GTM_ID so the tag is only
// injected when explicitly configured (keeps dev + previews clean). GA4 is
// configured inside GTM itself, not here.
export function GoogleTagManager() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID

  if (!gtmId) return null

  return <NextGoogleTagManager gtmId={gtmId} />
}

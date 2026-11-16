import type { MetadataRoute } from 'next'
import { isAuthGateActive } from '@/lib/auth/gate'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rejstudio.com'

  // While password-gated, every page redirects to the login form, so ask
  // crawlers to stay away rather than spend invocations on redirects.
  if (isAuthGateActive()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/genes', '/genes/'],
        disallow: ['/api/', '/design-tool'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

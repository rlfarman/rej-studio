import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rejstudio.com'

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

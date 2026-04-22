import '@/styles/globals.css'
import {
  Source_Code_Pro,
  Source_Sans_3,
  Source_Serif_4,
} from 'next/font/google'

// `next/font` auto-generates a metric-matched fallback (size-adjust /
// ascent-override) for each of these when adjustFontFallback is left at the
// default of true — that's what kills layout shift on first paint.
const fontSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
  adjustFontFallback: true,
})

const fontMono = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-mono',
  display: 'swap',
})

const fontDisplay = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
  adjustFontFallback: true,
})
import { ThemeProvider } from '@/app/_components/layout/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { QueryProvider } from '@/app/_components/providers/query-provider'
import { GoogleTagManager } from '@/components/google-tag-manager'
import { AnalyticsPageview } from '@/components/analytics-pageview'
import { AnalyticsProperties } from '@/components/analytics-properties'
import { WebVitals } from '@/components/web-vitals'
import { ConsoleGreeting } from '@/components/console-greeting'
import { Suspense } from 'react'
import { AuthGate } from '@/features/auth/components/auth-gate'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rejstudio.com'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'REJ Studio',
    template: '%s | REJ Studio',
  },
  description:
    'Search genes, browse isoforms, and design optimized RNA End-Joining sequences — all in one tool.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'REJ Studio',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'REJ Studio',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <head>
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <>
            <link
              rel="preconnect"
              href="https://www.googletagmanager.com"
              crossOrigin="anonymous"
            />
            <link
              rel="preconnect"
              href="https://www.google-analytics.com"
              crossOrigin="anonymous"
            />
          </>
        )}
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <a
              href="#main-content"
              className="focus:bg-background focus:text-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:shadow-md focus:ring-2"
            >
              Skip to content
            </a>
            <Suspense fallback={null}>
              <AuthGate>{children}</AuthGate>
            </Suspense>
            <Toaster />
            <Suspense fallback={null}>
              <AnalyticsPageview />
            </Suspense>
            <AnalyticsProperties />
          </QueryProvider>
        </ThemeProvider>
        <WebVitals />
        <ConsoleGreeting />
        <GoogleTagManager />
      </body>
    </html>
  )
}

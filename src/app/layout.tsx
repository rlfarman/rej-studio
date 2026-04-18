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
import { cookies, headers } from 'next/headers'
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session'
import { LoginForm } from '@/features/auth/components/login-form'

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

// Auth is engaged when BASIC_AUTH_PASSWORD is set. In dev, setting
// BYPASS_AUTH=true skips the gate entirely.
function authGateActive(): boolean {
  if (!process.env.BASIC_AUTH_PASSWORD) return false
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.BYPASS_AUTH === 'true'
  ) {
    return false
  }
  return true
}

async function isAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await verifySession(token)
  return session !== null
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const gateActive = authGateActive()
  const authed = gateActive ? await isAuthenticated() : true
  const hdrs = gateActive && !authed ? await headers() : null
  const pathname = hdrs?.get('x-pathname') ?? undefined
  const returnTo =
    pathname && pathname !== '/login' && !pathname.startsWith('/api/')
      ? pathname
      : undefined

  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <head />
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {authed ? (
              <>
                <a
                  href="#main-content"
                  className="focus:bg-background focus:text-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:shadow-md focus:ring-2"
                >
                  Skip to content
                </a>
                {children}
              </>
            ) : (
              <LoginForm returnTo={returnTo} />
            )}
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

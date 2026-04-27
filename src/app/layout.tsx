import '@/styles/globals.css'
import { fontVariableClassName } from '@/styles/fonts'
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

// Inline hydration script — reads the user's sidebar preferences from
// localStorage and applies them to <html> before React renders. Keeps the
// (app) layout fully static (no cookies() → no per-request dynamic SSR)
// while preserving sidebar state without a flash. Same pattern next-themes
// uses for dark mode.
const SIDEBAR_PRELOAD_SCRIPT = `(function(){try{var d=document.documentElement;var s=localStorage.getItem('rej-sidebar-state');if(s==='true'||s==='false')d.dataset.sidebarPreloadOpen=s;var w=localStorage.getItem('rej-sidebar-width');if(w&&/^\\d+$/.test(w)){var n=parseInt(w,10);if(n>=200&&n<=480){d.dataset.sidebarPreloadWidth=String(n);d.style.setProperty('--sidebar-width',n+'px');}}}catch(e){}})();`

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
    <html lang="en" className={fontVariableClassName} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_PRELOAD_SCRIPT }} />
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

import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Open_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Header from '@/components/header'
import Footer from '@/components/footer'

const openSans = Open_Sans({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'RNA End-joining Design Tool',
    template: '%s | REJ Studio',
  },
  description:
    'Design optimized RNA end-joining sequences for gene therapy research. Search genes, explore isoforms, and generate codon-optimized constructs.',
  openGraph: {
    title: 'RNA End-joining Design Tool',
    description:
      'Design optimized RNA end-joining sequences for gene therapy research.',
    type: 'website',
    siteName: 'REJ Studio',
  },
  twitter: {
    card: 'summary',
    title: 'RNA End-joining Design Tool',
    description:
      'Design optimized RNA end-joining sequences for gene therapy research.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${openSans.className} mx-auto flex min-h-screen flex-col justify-between`}
      >
        <div>
          <Header />
          <main className="container mx-auto mt-4 w-full max-w-screen-md flex-col px-4">
            {children}
          </main>
        </div>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}

import '@/styles/globals.css'
import Header from '@/components/header'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

export const metadata = {
  title: 'RNA End-joining Design Tool',
  description: 'RNA End-joining made easy',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head />
      <body
        className={`${GeistSans.className} mx-auto flex min-h-screen flex-col justify-between`}
      >
        <div className="relative flex min-h-screen flex-col pb-6">
          <Header />
          {children}
          <footer className="mx-auto mt-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h1 className="text-muted-foreground mt-2">REJ</h1>
            <p className="text-muted-foreground text-xs">
              PREVIEW - SALK INSTITUTE EYES ONLY
            </p>
            <p className="text-muted-foreground text-xs">
              Created by Richie Farman and Ryan Hsu.
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}

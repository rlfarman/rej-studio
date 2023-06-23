import '@/styles/globals.css'
import { Open_Sans } from 'next/font/google'
import Header from '@/components/header'

const openSans = Open_Sans({ subsets: ['latin'] })

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
    <html lang="en">
      <head />
      <body className={openSans.className}>
        <div className="container max-w-screen-lg mx-auto flex min-h-screen flex-col items-center px-12 py-6 md:items-start">
          <Header />
          <div className="w-full pt-4">{children}</div>
        </div>
      </body>
    </html>
  )
}

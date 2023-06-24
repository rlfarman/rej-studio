import '@/styles/globals.css'
import { Open_Sans } from 'next/font/google'
import Header from '@/components/header'
import Footer from '@/components/footer'

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
        <div className="container mx-auto flex min-h-screen max-w-screen-lg flex-col justify-between px-4 py-4 sm:px-12">
          <div>
            <Header />
            <div className="w-full pt-4">{children}</div>
          </div>
          <Footer />
        </div>
      </body>
    </html>
  )
}

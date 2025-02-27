import '@/styles/globals.css'
import { Open_Sans } from 'next/font/google'
import Header from '@/components/header'
import Footer from '@/components/footer'

const openSans = Open_Sans({ subsets: ['latin'] })

export const metadata = {
  title: 'RNA End-joining Design Tool',
  description: 'RNA End-joining made easy'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head />
      <body
        className={`${openSans.className} mx-auto flex min-h-screen flex-col justify-between`}
      >
        <div>
          <Header />
          <div className="container mx-auto mt-4 w-full max-w-(--breakpoint-md) flex-col px-4">
            {children}
          </div>
        </div>
        <Footer />
      </body>
    </html>
  )
}

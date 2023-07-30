import { Tilt_Warp } from 'next/font/google'
import cx from 'classnames'
import Link from 'next/link'
import Image from 'next/image'

const tiltWarp = Tilt_Warp({
  subsets: ['latin'],
})

export default function Header() {
  return (
    <header className="mx-auto max-w-screen-md pt-4">
      <div className="flex items-center">
        <div className="relative h-16 w-16 sm:h-24 sm:w-24">
          <Image
            src="/logo.svg"
            alt="RNA End-joining Logo"
            fill
            sizes="(max-width: 768px) 6rem, 4rem"
          />
        </div>
        <Link href="/">
          <div>
            <h1
              className={cx(
                'text-4xl text-emerald-500 dark:text-emerald-400 md:text-5xl',
                tiltWarp.className
              )}
            >
              RNA End-joining
            </h1>
            <span className="text-2xl text-sky-500 dark:text-sky-400 md:text-3xl">
              Design Tool
            </span>
          </div>
        </Link>
      </div>
    </header>
  )
}

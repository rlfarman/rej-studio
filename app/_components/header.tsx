import { Tilt_Warp } from 'next/font/google'
import cx from 'classnames'
import Link from 'next/link'

const tiltWarp = Tilt_Warp({
  subsets: ['latin'],
})

export default function Header() {
  return (
    <header className="w-full">
      <div className="flex items-center justify-between">
        <Link href="/">
          <div>
            <h1
              className={cx(
                'text-4xl text-emerald-500 dark:text-emerald-400 md:text-7xl lg:text-8xl',
                tiltWarp.className
              )}
            >
              RNA End-joining
            </h1>
            <span className="text-2xl text-sky-500 dark:text-sky-400 md:text-4xl">
              Design Tool
            </span>
          </div>
        </Link>
      </div>
    </header>
  )
}

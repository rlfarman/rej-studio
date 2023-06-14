import { Tilt_Warp } from 'next/font/google'
import cx from 'classnames'
import Link from 'next/link'

const tiltWarp = Tilt_Warp({
  subsets: ['latin'],
})

export default function Header() {
  return (
    <header className="w-full text-center md:text-left">
      <div className="flex items-center justify-between">
        <Link href="/">
          <div>
            <h1
              className={cx(
                'text-4xl text-emerald-500 md:text-6xl xl:text-8xl',
                tiltWarp.className
              )}
            >
              RNA End-joining
            </h1>
            <span className="text-2xl text-sky-500 md:text-4xl">
              Design Tool
            </span>
          </div>
        </Link>
      </div>
    </header>
  )
}

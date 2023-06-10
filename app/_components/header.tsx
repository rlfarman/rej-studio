import { Tilt_Warp } from 'next/font/google'
import cx from 'classnames'

const tiltWarp = Tilt_Warp({
  subsets: ['latin'],
})

export default function Header() {
  return (
    <header className="container py-8 px-4">
      <h1 className={cx('text-4xl md:text-8xl', tiltWarp.className)}>
        <span className="text-emerald-500">RNA End-joining</span>{' '}
      </h1>
      <span className="text-2xl md:text-4xl text-sky-500">Design Tool</span>
    </header>
  )
}

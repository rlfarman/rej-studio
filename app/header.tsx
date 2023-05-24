import { Bangers } from 'next/font/google'

const bangers = Bangers({
  subsets: ['latin'],
  weight: '400',
})
export default function Header() {
  return (
    <div className="z-10 w-full max-w-5xl items-center justify-between text-sm lg:flex">
      <h1 className={`text-6xl md:text-8xl ${bangers.className}`}>
        <span className="text-emerald-500">Gene</span>{' '}
        <span className="text-sky-500">Splitter</span>
      </h1>
      {/* <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
        <a>Learn more</a>
      </div> */}
    </div>
  )
}

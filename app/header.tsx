import { Bangers } from 'next/font/google'

const bangers = Bangers({
  subsets: ['latin'],
  weight: '400',
})

export default function Header() {
  return (
    <header className="container py-8 px-4">
      <h1 className={`text-6xl md:text-8xl ${bangers.className}`}>
        <span className="text-emerald-500">Gene</span>{' '}
        <span className="text-sky-500">Splitter</span>
      </h1>
    </header>
  )
}

import {
  Source_Code_Pro,
  Source_Sans_3,
  Source_Serif_4,
} from 'next/font/google'

const fontSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
  adjustFontFallback: true,
})

const fontMono = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-mono',
  display: 'swap',
})

const fontSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
  adjustFontFallback: true,
})

export const fontVariableClassName = `${fontSans.variable} ${fontMono.variable} ${fontSerif.variable}`

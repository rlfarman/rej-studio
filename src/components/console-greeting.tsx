'use client'

import { useEffect } from 'react'

const ART = String.raw`
    ╭─╮           ╭─╮
    │ A ══════════ T │
    │ T ══════════ A │
     ╲╱            ╲╱
     ╱╲            ╱╲
    │ G ══════════ C │
    │ C ══════════ G │
    ╰─╯           ╰─╯
`

// DevTools console can't read CSS custom properties, so these hex values
// mirror (approximately) --success / --muted-foreground / --info from
// globals.css. Keep in sync if the palette shifts.
const CONSOLE_SUCCESS = '#86efac'
const CONSOLE_MUTED = '#94a3b8'
const CONSOLE_INFO = '#93c5fd'

export function ConsoleGreeting() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as Window & { __rejGreeted?: boolean }
    if (w.__rejGreeted) return
    w.__rejGreeted = true

    const heading = `color:${CONSOLE_SUCCESS};font-weight:600;font-size:13px`
    const body = `color:${CONSOLE_MUTED};font-size:12px;line-height:1.5`
    const code = `color:${CONSOLE_INFO};font-family:ui-monospace,monospace;font-size:12px`

    console.log(
      `%cHey, a scientist with DevTools open.%c${ART}%c\nREJ Studio is open source — and we welcome PRs.\nSource: %chttps://github.com/rlfarman/rej-studio`,
      heading,
      code,
      body,
      code,
    )
  }, [])

  return null
}

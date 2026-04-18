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

export function ConsoleGreeting() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as Window & { __rejGreeted?: boolean }
    if (w.__rejGreeted) return
    w.__rejGreeted = true

    const heading = 'color:#86efac;font-weight:600;font-size:13px'
    const body = 'color:#94a3b8;font-size:12px;line-height:1.5'
    const code =
      'color:#93c5fd;font-family:ui-monospace,monospace;font-size:12px'

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

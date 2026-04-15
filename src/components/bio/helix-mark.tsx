import type { SVGProps } from 'react'

type HelixMarkProps = SVGProps<SVGSVGElement> & {
  rungs?: number
}

export function HelixMark({ rungs = 9, className, ...rest }: HelixMarkProps) {
  const pathA = 'M10 4 C 38 18, 38 46, 10 60 S -18 104, 10 118'
  const pathB = 'M54 4 C 26 18, 26 46, 54 60 S 82 104, 54 118'
  const rungData = Array.from({ length: rungs }, (_, i) => {
    const t = i / (rungs - 1)
    const y = 6 + t * 110
    const phase = Math.sin(t * Math.PI * 2)
    const x1 = 32 - phase * 20
    const x2 = 32 + phase * 20
    const opacity = 0.35 + Math.abs(phase) * 0.5
    return { y, x1, x2, opacity, key: i }
  })

  return (
    <svg
      viewBox="0 0 64 122"
      fill="none"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <defs>
        <linearGradient id="helix-strand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.55" />
          <stop offset="45%" stopColor="var(--brand)" stopOpacity="1" />
          <stop
            offset="100%"
            stopColor="var(--accent-warm)"
            stopOpacity="0.9"
          />
        </linearGradient>
      </defs>
      <g stroke="url(#helix-strand)" strokeLinecap="round">
        {rungData.map((r) => (
          <line
            key={r.key}
            x1={r.x1}
            x2={r.x2}
            y1={r.y}
            y2={r.y}
            strokeWidth={1.5}
            strokeOpacity={r.opacity}
          />
        ))}
        <path d={pathA} strokeWidth={3} />
        <path d={pathB} strokeWidth={3} />
      </g>
    </svg>
  )
}

// Pre-computed at module scope to avoid hydration mismatches (same pattern as DnaLoader).
const HALF_PERIOD = 130
const AMPLITUDE = 72
const CENTER_Y = 180
const TOTAL_WIDTH = 1440
const RUNG_STEP = 20

const HELIX_RUNGS = Array.from(
  { length: Math.floor(TOTAL_WIDTH / RUNG_STEP) + 1 },
  (_, i) => {
    const x = i * RUNG_STEP
    const amp = Math.abs(Math.sin((x / HALF_PERIOD) * Math.PI)) * AMPLITUDE
    return {
      x,
      y1: Number((CENTER_Y - amp).toFixed(2)),
      y2: Number((CENTER_Y + amp).toFixed(2)),
    }
  },
).filter((r) => r.y2 - r.y1 > 5)

const halfPeriodCount = Math.ceil(TOTAL_WIDTH / HALF_PERIOD)
const tCommands = Array.from(
  { length: halfPeriodCount - 1 },
  (_, i) => `T ${Math.min((i + 2) * HALF_PERIOD, TOTAL_WIDTH)} ${CENTER_Y}`,
).join(' ')

const STRAND_UP = `M0 ${CENTER_Y} Q ${HALF_PERIOD / 2} ${CENTER_Y - AMPLITUDE} ${HALF_PERIOD} ${CENTER_Y} ${tCommands}`
const STRAND_DOWN = `M0 ${CENTER_Y} Q ${HALF_PERIOD / 2} ${CENTER_Y + AMPLITUDE} ${HALF_PERIOD} ${CENTER_Y} ${tCommands}`

export function LoginBackground() {
  return (
    <svg
      viewBox={`0 0 ${TOTAL_WIDTH} 360`}
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Strand 1 — flows forward */}
      <path
        d={STRAND_UP}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="38 12"
        className="stroke-primary/30 [animation:helix-bg-flow_5s_linear_infinite,dna-strand-breathe_4s_ease-in-out_infinite] motion-reduce:animate-none"
      />
      {/* Strand 2 — flows in reverse, slightly dimmer */}
      <path
        d={STRAND_DOWN}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="38 12"
        className="stroke-primary/20 [animation:helix-bg-flow_5s_linear_infinite_reverse,dna-strand-breathe_4s_ease-in-out_2s_infinite] motion-reduce:animate-none"
      />
      {/* Rungs — glow sequentially */}
      {HELIX_RUNGS.map(({ x, y1, y2 }, i) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1={y1}
          y2={y2}
          strokeWidth={1}
          strokeLinecap="round"
          className="stroke-primary/25 [animation:dna-rung-glow_2.8s_ease-in-out_infinite] [animation-fill-mode:backwards] motion-reduce:animate-none"
          style={{ animationDelay: `${(i % 14) * 120}ms` }}
        />
      ))}
    </svg>
  )
}

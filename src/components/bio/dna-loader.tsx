import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

// Pre-compute rung geometry at module scope and round to 3 decimals. The
// raw `Math.sin` output can serialize to slightly different strings on
// Node and the browser, triggering React 19 hydration mismatches; fixed
// precision keeps both sides byte-identical.
const RUNGS = [0, 12, 24, 36, 48, 60].map((x) => {
  const amp = Math.abs(Math.sin((x / 18) * Math.PI)) * 8
  return {
    x,
    y1: Number((12 - amp).toFixed(3)),
    y2: Number((12 + amp).toFixed(3)),
  }
})

/**
 * On-theme loading indicator. A static DNA double helix whose strands
 * carry a subtle flowing current (dash pattern + breathing stroke width)
 * while the rungs glow left-to-right in sequence.
 *
 * The SVG is aria-hidden; callers are responsible for announcing the
 * loading state (wrap in a role="status" region with an aria-label, or
 * pair with visible loading copy).
 */
export function DnaLoader({ className }: Props) {
  return (
    <svg
      viewBox="0 0 72 24"
      className={cn('h-6 w-[72px]', className)}
      aria-hidden="true"
    >
      <path
        d="M0 12 Q 9 2 18 12 T 36 12 T 54 12 T 72 12"
        className="stroke-primary/70 [animation:dna-strand-flow_3.2s_linear_infinite,dna-strand-breathe_2.8s_ease-in-out_infinite] fill-none motion-reduce:animate-none"
        strokeLinecap="round"
        pathLength={48}
        strokeDasharray="22 2"
      />
      <path
        d="M0 12 Q 9 22 18 12 T 36 12 T 54 12 T 72 12"
        className="stroke-primary/40 [animation:dna-strand-flow_3.2s_linear_infinite_reverse,dna-strand-breathe_2.8s_ease-in-out_infinite_reverse] fill-none motion-reduce:animate-none"
        strokeLinecap="round"
        pathLength={48}
        strokeDasharray="22 2"
      />
      {RUNGS.map(({ x, y1, y2 }, i) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1={y1}
          y2={y2}
          className="stroke-primary [animation:dna-rung-glow_1.8s_ease-in-out_infinite] motion-reduce:animate-none"
          strokeWidth={1.25}
          strokeLinecap="round"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </svg>
  )
}

import type { ReactNode } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { cn } from '@/lib/utils'

interface StatusPageProps {
  /** Small label above the title, e.g. "404 · Page not found". */
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  /** Secondary line under the description. */
  detail?: ReactNode
  /** Buttons/links. Put the primary action first. */
  actions?: ReactNode
  /** Extra content between the copy and the actions (e.g. suggestions). */
  children?: ReactNode
  /**
   * Fill the viewport and show the brand mark. For root-level pages that
   * render outside the app chrome (no sidebar or header).
   */
  standalone?: boolean
  /** Strand motif: a gap where something is missing, or a misjoined break. */
  tone?: 'missing' | 'error'
}

/**
 * Shared layout for 404 and error states. Left-aligned and editorial rather
 * than a centered card, with a small sequence-strand motif that matches the
 * split-bar visuals used across the app.
 */
export function StatusPage({
  eyebrow,
  title,
  description,
  detail,
  actions,
  children,
  standalone = false,
  tone = 'missing',
}: StatusPageProps) {
  const body = (
    <section
      className={cn(
        'fade-up flex w-full max-w-xl flex-col gap-5',
        !standalone && 'px-6 pt-16 pb-12 md:px-10 md:pt-24',
      )}
    >
      <StrandMotif tone={tone} />
      <div className="flex flex-col gap-3">
        <p className="type-overline">{eyebrow}</p>
        <h1 className="type-page-title">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-base leading-relaxed text-pretty">
            {description}
          </p>
        )}
        {detail && (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {detail}
          </p>
        )}
      </div>
      {children}
      {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
    </section>
  )

  if (!standalone) return body

  return (
    <main
      id="main-content"
      className="relative flex min-h-svh flex-col px-6 py-6 md:px-10"
    >
      <BrandMark />
      <div className="flex flex-1 items-center">{body}</div>
    </main>
  )
}

/**
 * Two strand halves with ticks for bases. "missing" leaves a dashed gap in
 * the signature lime; "error" misaligns the 3′ half, like a failed join.
 */
function StrandMotif({ tone }: { tone: 'missing' | 'error' }) {
  const ticks = (from: number, to: number, y: number) =>
    Array.from({ length: Math.floor((to - from) / 10) + 1 }, (_, i) => (
      <line
        key={`${from}-${i}`}
        x1={from + i * 10}
        x2={from + i * 10}
        y1={y - 5}
        y2={y + 5}
      />
    ))
  const rightY = tone === 'error' ? 20 : 12

  return (
    <svg
      aria-hidden
      viewBox="0 0 220 32"
      className="h-8 w-[220px] overflow-visible"
      fill="none"
      strokeLinecap="round"
    >
      <g className="stroke-primary/25" strokeWidth={1.5}>
        {ticks(6, 86, 12)}
        {ticks(134, 214, rightY)}
      </g>
      <line
        x1={4}
        x2={88}
        y1={12}
        y2={12}
        className="stroke-primary"
        strokeWidth={3}
      />
      <line
        x1={132}
        x2={216}
        y1={rightY}
        y2={rightY}
        className="stroke-primary"
        strokeWidth={3}
      />
      {tone === 'missing' ? (
        <rect
          x={98}
          y={5}
          width={24}
          height={14}
          rx={3}
          className="stroke-spark"
          strokeWidth={2}
          strokeDasharray="3 3"
        />
      ) : (
        <path
          d="M92 12 L104 12 M116 20 L128 20"
          className="stroke-spark"
          strokeWidth={3}
        />
      )}
    </svg>
  )
}

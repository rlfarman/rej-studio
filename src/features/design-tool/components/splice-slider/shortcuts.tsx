import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MULTI_SPLIT_ENABLED } from '../../utils/feature-flags'

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-lg border bg-background px-1 font-mono type-micro font-semibold text-foreground">
      {children}
    </kbd>
  )
}

export function ShortcutHint({
  active,
  spliceCount = 1,
}: {
  active: boolean
  spliceCount?: number
}) {
  // Static documentation, not duplicate UI: hints describe the shortcut,
  // they don't fire it. Hidden below md (no physical keyboard typically).
  return (
    <div
      className={cn(
        'hidden flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground transition-opacity md:flex',
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!active}
    >
      {MULTI_SPLIT_ENABLED && spliceCount > 1 && (
        <span className="flex items-center gap-1">
          <Kbd>1</Kbd>
          <Kbd>2</Kbd>
          <span>focus</span>
        </span>
      )}
      <span className="flex items-center gap-1">
        <Kbd>[</Kbd>
        <Kbd>]</Kbd>
        <span>step site</span>
      </span>
      <span className="flex items-center gap-1">
        <Kbd>m</Kbd>
        <span>midpoint</span>
      </span>
      <span className="flex items-center gap-1">
        <Kbd>↵</Kbd>
        <span>find / jump</span>
      </span>
    </div>
  )
}

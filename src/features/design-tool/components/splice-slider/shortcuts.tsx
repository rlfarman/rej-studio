import type { ReactNode } from 'react'
import { designToolCopy } from '../../copy'
import { MULTI_SPLIT_ENABLED } from '../../utils/feature-flags'

const copy = designToolCopy.spliceEditor.shortcuts

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-lg border bg-background px-1 font-mono type-micro font-semibold text-foreground">
      {children}
    </kbd>
  )
}

export function ShortcutHint({ spliceCount = 1 }: { spliceCount?: number }) {
  // Static documentation, not duplicate UI: hints describe the shortcut,
  // they don't fire it. Hidden below md (no physical keyboard typically).
  // Always shown: it used to appear only once the editor had focus, so the
  // keys were undiscoverable unless you already knew them.
  return (
    <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground md:flex">
      {MULTI_SPLIT_ENABLED && spliceCount > 1 && (
        <span className="flex items-center gap-1">
          <Kbd>1</Kbd>
          <Kbd>2</Kbd>
          <span>{copy.focus}</span>
        </span>
      )}
      <span className="flex items-center gap-1">
        <Kbd>[</Kbd>
        <Kbd>]</Kbd>
        <span>{copy.stepSite}</span>
      </span>
      <span className="flex items-center gap-1">
        <Kbd>m</Kbd>
        <span>{copy.midpoint}</span>
      </span>
      <span className="flex items-center gap-1">
        <Kbd>↵</Kbd>
        <span>{copy.findJump}</span>
      </span>
    </div>
  )
}

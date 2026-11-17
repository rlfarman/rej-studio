import { useId } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { designToolCopy } from '../copy'

const copy = designToolCopy.cloud

interface CloudRunToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

/**
 * "Run in the cloud", beside Run designer. Off by default, and its one line
 * of copy is always visible, not behind a tooltip: it is the whole of the
 * privacy trade-off (the sequence leaves this machine), and the person has to
 * be able to read it before they tick the box.
 */
export function CloudRunToggle({
  checked,
  onCheckedChange,
  disabled = false,
}: CloudRunToggleProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className="flex max-w-xs items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-describedby={hintId}
        className="mt-0.5"
      />
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="text-sm leading-none font-medium">
          {copy.toggleLabel}
        </label>
        <p id={hintId} className="text-xs text-muted-foreground">
          {copy.toggleHint}
        </p>
      </div>
    </div>
  )
}

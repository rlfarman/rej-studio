'use client'
import { type ComponentProps, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

type IconComponent = React.ComponentType<{ className?: string }>

interface CopyButtonProps {
  /** Either a static string or a function (useful when the text is expensive to compute). */
  text: string | (() => string)
  /** Label shown in the default state. */
  children: ReactNode
  /** Optional label shown while the copied state is active. Omit to keep the label constant. */
  copiedLabel?: ReactNode
  /** Icon shown in the default state. Defaults to the Copy glyph. */
  icon?: IconComponent
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  className?: string
  disabled?: boolean
  /** Show a success toast on copy. Defaults to false since the icon swap already provides feedback. */
  showToast?: boolean
  /** How long the copied state persists (ms). */
  resetDelay?: number
  'aria-label'?: string
}

export function CopyButton({
  text,
  children,
  copiedLabel,
  icon: Icon = Copy,
  variant = 'ghost',
  size = 'sm',
  className,
  disabled,
  showToast = false,
  resetDelay,
  'aria-label': ariaLabel,
}: CopyButtonProps) {
  const { copy, isCopied } = useCopyToClipboard({ showToast, resetDelay })
  const copied = isCopied()

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={() => copy(typeof text === 'function' ? text() : text)}
    >
      {copied ? <Check className="size-3" /> : <Icon className="size-3" />}
      {copied && copiedLabel !== undefined ? copiedLabel : children}
    </Button>
  )
}

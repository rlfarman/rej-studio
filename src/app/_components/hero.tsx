import { type ReactNode } from 'react'

export function Hero({ children }: { children: ReactNode }) {
  return <div className="w-full min-w-0">{children}</div>
}

export function HeroItem({
  children,
  className,
  index = 0,
  ...rest
}: React.ComponentProps<'div'> & {
  index?: number
}) {
  return (
    <div
      className={`hero-stagger ${className ?? ''}`}
      style={{ '--stagger': index } as React.CSSProperties}
      {...rest}
    >
      {children}
    </div>
  )
}

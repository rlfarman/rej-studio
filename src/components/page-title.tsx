import { cn } from '@/lib/utils'

interface PageTitleProps extends React.ComponentProps<'h1'> {
  as?: 'h1' | 'h2'
}

export function PageTitle({
  as: Comp = 'h1',
  className,
  children,
  ...props
}: PageTitleProps) {
  return (
    <Comp
      className={cn('type-page-title text-foreground', className)}
      {...props}
    >
      {children}
    </Comp>
  )
}

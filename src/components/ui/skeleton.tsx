import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'bg-primary/10 relative overflow-hidden rounded-md',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-[skeleton-shimmer_1.8s_ease-in-out_infinite]',
        'before:via-primary/5 before:bg-gradient-to-r before:from-transparent before:to-transparent',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }

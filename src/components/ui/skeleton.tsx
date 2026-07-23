import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('skeleton-block rounded-md', className)}
      {...props}
    />
  )
}

type SkeletonBusyProps = ComponentProps<'div'> & {
  busy: boolean
}

/** Wraps a skeleton set; exposes loading state to assistive tech. */
export function SkeletonBusy({ busy, className, children, ...props }: SkeletonBusyProps) {
  return (
    <div aria-busy={busy} aria-live="polite" className={className} {...props}>
      {children}
    </div>
  )
}

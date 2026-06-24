import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Scribe skeleton — shimmer / pulse loading placeholders.
 *
 * Features:
 *   - Uses the `.skeleton` CSS class from index.css (gradient shimmer animation)
 *   - Pulse animation fallback for reduced-motion environments
 *   - Shape variants: default (any), circle (avatar), text (lines), card (blocks)
 *
 * Usage:
 *   <Skeleton className="h-8 w-8" shape="circle" />
 *   <Skeleton className="h-4 w-3/4" shape="text" />
 *   <Skeleton className="h-40 w-full" shape="card" />
 */
const skeletonVariants = cva(
  'skeleton', // defined in index.css @layer components
  {
    variants: {
      shape: {
        default: '',
        circle: 'rounded-full',
        text: 'h-4 w-full rounded-md',
        card: 'h-40 w-full rounded-2xl',
      },
      animation: {
        shimmer: '',
        pulse: 'animate-pulse [animation-duration:1.5s]',
      },
    },
    defaultVariants: {
      shape: 'default',
      animation: 'shimmer',
    },
  },
)

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, shape, animation, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(skeletonVariants({ shape, animation, className }))}
      {...props}
    />
  ),
)
Skeleton.displayName = 'Skeleton'

export { Skeleton, skeletonVariants }

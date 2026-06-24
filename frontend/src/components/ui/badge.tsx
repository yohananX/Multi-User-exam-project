import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Scribe badge — status / label pills.
 *
 * Changes from baseline:
 *   - rounded-full by default (pill shape)
 *   - Softer background colours using status-*-bg tokens
 *   - Subtle inner shadow for depth via `shadow-[inset_0_1px_0_hsl(...)]`
 *   - Optional animation prop (pulse | shimmer)
 *   - Preserves all existing variant names
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-[inset_0_1px_0_hsl(var(--text-primary)/0.06)]',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        outline: 'text-foreground',
        pending: 'border-transparent bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]',
        processing: 'border-transparent bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing))]',
        completed: 'border-transparent bg-[hsl(var(--status-completed-bg))] text-[hsl(var(--status-completed))]',
        rejected: 'border-transparent bg-[hsl(var(--status-rejected-bg))] text-[hsl(var(--status-rejected))]',
        approved: 'border-transparent bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved))]',
      },
      animation: {
        none: '',
        pulse: 'animate-pulse',
        shimmer: 'animate-[shimmer_1.5s_ease-in-out_infinite] bg-[length:200%_100%]',
      },
    },
    defaultVariants: {
      variant: 'default',
      animation: 'none',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, animation, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, animation }), className)} {...props} />
}

export { Badge, badgeVariants }

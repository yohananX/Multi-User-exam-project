import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary shadow-sm',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        outline: 'text-foreground',
        pending: 'border-transparent bg-[hsl(var(--status-pending)/0.15)] text-[hsl(var(--status-pending))]',
        processing: 'border-transparent bg-[hsl(var(--status-processing)/0.15)] text-[hsl(var(--status-processing))]',
        completed: 'border-transparent bg-[hsl(var(--status-completed)/0.15)] text-[hsl(var(--status-completed))]',
        rejected: 'border-transparent bg-[hsl(var(--status-rejected)/0.15)] text-[hsl(var(--status-rejected))]',
        approved: 'border-transparent bg-[hsl(var(--status-approved)/0.15)] text-[hsl(var(--status-approved))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

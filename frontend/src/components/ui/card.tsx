import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Scribe card — Apple-like surface container.
 *
 * Features:
 *   - rounded-2xl by default (Apple-style rounding)
 *   - Optional hover lift effect (hover:shadow-lg hover:-translate-y-0.5)
 *   - Optional entrance animation (fadeIn / slideUp / scaleIn)
 *   - Fully backward-compatible API
 */
const cardVariants = cva(
  'rounded-2xl border bg-card text-card-foreground shadow-sm',
  {
    variants: {
      hover: {
        true: 'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
        false: '',
      },
      animation: {
        none: '',
        fadeIn: 'animate-[fadeIn_0.3s_ease-out]',
        slideUp: 'animate-[slideUp_0.4s_ease-out]',
        scaleIn: 'animate-[scaleIn_0.3s_ease-out]',
      },
    },
    defaultVariants: {
      hover: false,
      animation: 'none',
    },
  },
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover, animation, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ hover, animation, className }))}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'

export {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  CardFooter,
  cardVariants,
}


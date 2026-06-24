import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* ── Avatar root ─────────────────────────────────────── */

const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full',
  {
    variants: {
      size: {
        default: 'h-10 w-10',
        sm: 'h-8 w-8',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16',
      },
      /** Subtle ring offset from the surface for depth */
      ring: {
        none: '',
        true: 'ring-2 ring-surface ring-offset-2 ring-offset-background',
      },
    },
    defaultVariants: {
      size: 'default',
      ring: false,
    },
  },
)

/* ── Avatar fallback (gradient backgrounds) ──────────── */

const avatarFallbackVariants = cva(
  'flex h-full w-full items-center justify-center rounded-full text-sm font-medium',
  {
    variants: {
      gradient: {
        none: 'bg-muted',
        accent: 'bg-gradient-to-br from-accent/20 to-accent/5 text-accent',
        sunset: 'bg-gradient-to-br from-[hsl(0_72%_51%)]/10 to-[hsl(38_92%_50%)]/10 text-[hsl(0_72%_51%)]',
        ocean: 'bg-gradient-to-br from-[hsl(211_100%_50%)]/10 to-[hsl(142_71%_45%)]/10 text-[hsl(211_100%_50%)]',
        neutral: 'bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/5 text-muted-foreground',
      },
    },
    defaultVariants: {
      gradient: 'none',
    },
  },
)

/* ── Status dot colour map ───────────────────────────── */

const statusDotColors = {
  online: 'bg-[hsl(142_71%_45%)]',
  offline: 'bg-[hsl(0_0%_70%)]',
  away: 'bg-[hsl(38_92%_50%)]',
  busy: 'bg-[hsl(0_72%_51%)]',
} as const

type StatusDot = keyof typeof statusDotColors

/* ── Exported props ──────────────────────────────────── */

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  /** Show a status indicator dot at the bottom-right corner */
  status?: StatusDot
}

export interface AvatarFallbackProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>,
    VariantProps<typeof avatarFallbackVariants> {}

/* ── Components ──────────────────────────────────────── */

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, ring, status, children, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(avatarVariants({ size, ring, className }))}
    {...props}
  >
    {children}
    {status && (
      <span
        className={cn(
          'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border-2 border-background',
          statusDotColors[status],
        )}
        aria-label={status}
      />
    )}
  </AvatarPrimitive.Root>
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full object-cover', className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, gradient, children, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(avatarFallbackVariants({ gradient, className }))}
    {...props}
  >
    {children}
  </AvatarPrimitive.Fallback>
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback, avatarVariants, avatarFallbackVariants }

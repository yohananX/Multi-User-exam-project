import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional icon element rendered on the left side of the input */
  icon?: React.ReactNode
}

/**
 * Scribe input — polished text field with icon support.
 *
 * Enhancements:
 *   - rounded-xl by default (was rounded-lg)
 *   - Focus ring glow: 3px accent halo via `shadow-[0_0_0_3px_hsl(var(--accent)/0.1)]`
 *   - Better dark-mode compatibility (uses design tokens throughout)
 *   - Left icon support via `icon` prop (wrapped in absolute-positioned container)
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4"
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-all duration-200',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:shadow-[0_0_0_3px_hsl(var(--accent)/0.1)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
            icon && 'pl-9',
            className,
          )}
          ref={ref}
          {...props}
        />
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input }

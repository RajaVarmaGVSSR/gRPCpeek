import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

const variantStyles = {
  ghost:
    'text-muted-foreground hover:text-foreground hover:bg-surface-muted/60 focus-visible:ring-2 focus-visible:ring-focus/40',
  danger:
    'text-danger hover:text-danger hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger/40',
}

const sizeStyles = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center rounded-lg transition-colors duration-brand ease-brand disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none',
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      />
    )
  }
)

IconButton.displayName = 'IconButton'

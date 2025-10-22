import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-surface-emphasis text-surface-contrast shadow-soft transition-all duration-200 ease-in-out hover:bg-accent hover:text-accent-contrast hover:shadow-md hover:scale-105 active:scale-100 focus-visible:ring-2 focus-visible:ring-focus/60',
  secondary:
    'bg-surface text-foreground border border-border/80 transition-all duration-200 ease-in-out hover:border-focus/60 hover:bg-surface-muted hover:shadow-sm hover:scale-102 active:scale-100 focus-visible:ring-2 focus-visible:ring-focus/50',
  ghost:
    'bg-transparent text-foreground transition-all duration-150 ease-in-out hover:bg-surface-muted/60 hover:scale-105 active:scale-100 focus-visible:ring-2 focus-visible:ring-focus/40',
  danger:
    'bg-red-500 text-white shadow-soft transition-all duration-200 ease-in-out hover:bg-red-600 hover:shadow-md hover:scale-105 active:scale-100 focus-visible:ring-2 focus-visible:ring-red-400/60',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none',
          sizeStyles[size],
          variantStyles[variant],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

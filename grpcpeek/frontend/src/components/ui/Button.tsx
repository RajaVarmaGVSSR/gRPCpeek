import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-surface-emphasis text-surface-contrast shadow-soft transition-colors duration-brand ease-brand hover:bg-accent hover:text-accent-contrast focus-visible:ring-2 focus-visible:ring-focus/60',
  secondary:
    'bg-surface text-foreground border border-border/80 transition-colors duration-brand ease-brand hover:border-focus/60 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus/50',
  ghost:
    'bg-transparent text-foreground transition-colors duration-brand ease-brand hover:bg-surface-muted/60 focus-visible:ring-2 focus-visible:ring-focus/40',
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

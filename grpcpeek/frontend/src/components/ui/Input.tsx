import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-10 w-full rounded-xl border border-border/70 bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground/80 shadow-sm transition duration-brand ease-brand focus-visible:border-focus/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    />
  )
)

Input.displayName = 'Input'

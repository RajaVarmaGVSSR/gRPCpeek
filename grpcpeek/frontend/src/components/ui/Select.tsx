import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-border/70 bg-surface px-3 text-sm text-foreground shadow-sm transition duration-brand ease-brand focus-visible:border-focus/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    />
  )
)

Select.displayName = 'Select'

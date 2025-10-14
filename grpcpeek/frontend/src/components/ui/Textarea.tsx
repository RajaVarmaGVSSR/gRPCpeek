import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 6, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full rounded-xl border border-border/70 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 shadow-sm transition duration-brand ease-brand focus-visible:border-focus/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 disabled:cursor-not-allowed disabled:opacity-60',
        'font-mono',
        className
      )}
      {...props}
    />
  )
)

Textarea.displayName = 'Textarea'

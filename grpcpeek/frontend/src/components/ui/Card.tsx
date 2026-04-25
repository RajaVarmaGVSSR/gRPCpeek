import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'solid' | 'muted'
  interactive?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone = 'solid', interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded bg-surface transition-colors duration-brand ease-brand',
        'border border-border/70 shadow-soft dark:shadow-[0_2px_12px_rgba(0,0,0,0.5)]',
        tone === 'muted' && 'bg-surface-muted',
        interactive && 'hover:border-focus/60 hover:shadow-soft-lg dark:hover:border-white/[0.12]',
        className
      )}
      {...props}
    />
  )
)

Card.displayName = 'Card'

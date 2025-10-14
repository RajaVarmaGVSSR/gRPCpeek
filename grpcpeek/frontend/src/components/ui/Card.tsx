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
        'rounded-2xl border border-border/70 bg-surface shadow-soft transition-colors duration-brand ease-brand',
        tone === 'muted' && 'bg-surface-muted',
        interactive && 'hover:border-focus/60 hover:shadow-soft-lg',
        className
      )}
      {...props}
    />
  )
)

Card.displayName = 'Card'

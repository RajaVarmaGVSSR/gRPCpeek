import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

type BadgeVariant = 'neutral' | 'positive' | 'warning' | 'blue' | 'green' | 'orange' | 'purple'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral: 'bg-muted text-muted-foreground',
  positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
}

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}

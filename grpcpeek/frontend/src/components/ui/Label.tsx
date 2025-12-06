import { forwardRef } from 'react'
import type { LabelHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium text-muted-foreground', className)}
      {...props}
    />
  )
)

Label.displayName = 'Label'

interface SkeletonProps {
  className?: string
  width?: string
  height?: string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

export function Skeleton({ className = '', width, height, rounded = 'md' }: SkeletonProps) {
  const roundedClasses = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }

  return (
    <div
      className={`animate-pulse bg-surface-muted/50 ${roundedClasses[rounded]} ${className}`}
      style={{ width, height }}
    />
  )
}

export function ServiceListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border border-border/70 bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton width="16px" height="16px" rounded="sm" />
            <Skeleton width="60%" height="16px" />
          </div>
          <Skeleton width="40%" height="12px" className="mt-1" />
        </div>
      ))}
    </div>
  )
}

export function ResponseSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton width="80px" height="24px" rounded="full" />
        <Skeleton width="60px" height="24px" rounded="full" />
      </div>
      <div className="space-y-2">
        <Skeleton width="100%" height="16px" />
        <Skeleton width="95%" height="16px" />
        <Skeleton width="90%" height="16px" />
        <Skeleton width="98%" height="16px" />
        <Skeleton width="92%" height="16px" />
      </div>
    </div>
  )
}

export function TabsSkeleton() {
  return (
    <div className="flex gap-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} width="150px" height="36px" rounded="lg" />
      ))}
    </div>
  )
}

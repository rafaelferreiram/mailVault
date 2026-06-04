import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-px">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 panel-inset grid-row"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Skeleton className="h-5 w-5" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-2.5 w-1/3" />
            <Skeleton className="h-2 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

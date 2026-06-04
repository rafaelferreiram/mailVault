import clsx from 'clsx';
import type { ReactNode } from 'react';

type Props = {
  label: string;
  className?: string;
  colSpan?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
};

export function DashboardCard({
  label,
  className,
  colSpan,
  headerRight,
  footer,
  children,
  onClick,
}: Props) {
  return (
    <section
      className={clsx(
        'dashboard-card panel flex flex-col min-h-0 p-4',
        colSpan,
        onClick && 'cursor-pointer hover:bg-bg-hover transition-colors duration-120',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <header className="flex items-center justify-between gap-2 mb-3 shrink-0">
        <span className="label-mono text-[10px] tracking-[0.1em]">{label}</span>
        {headerRight}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
      {footer && <footer className="mt-3 pt-2 border-t border-border-subtle text-[10px]">{footer}</footer>}
    </section>
  );
}

export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('dashboard-card panel p-4', className)}>
      <div className="dashboard-shimmer h-3 w-24 mb-4 rounded-sm" />
      <div className="dashboard-shimmer h-20 w-full rounded-sm" />
    </div>
  );
}

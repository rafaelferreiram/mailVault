import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

interface Props {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'spinner' | 'dots';
}

export function LoadingIndicator({
  label,
  size = 'md',
  className,
  variant = 'spinner',
}: Props) {
  const iconSize =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-9 h-9' : 'w-6 h-6';

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-2.5 animate-fade-in',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {variant === 'spinner' ? (
        <Loader2 className={clsx(iconSize, 'text-accent animate-spin')} aria-hidden />
      ) : (
        <div className="loading-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      )}
      {label && (
        <p
          className={clsx(
            'font-mono uppercase tracking-widest text-fg-muted animate-sync-pulse text-center',
            size === 'sm' ? 'text-[9px]' : 'text-[10px]'
          )}
        >
          {label}
        </p>
      )}
    </div>
  );
}

/** Thin indeterminate bar for inline loading (e.g. refresh while list visible). */
export function LoadingBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="loading-bar shrink-0" role="progressbar" aria-label="Loading">
      <div className="loading-bar__track" />
    </div>
  );
}

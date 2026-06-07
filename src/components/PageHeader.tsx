import { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: ReactNode;
  badge?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, badge, actions }: Props) {
  return (
    <div className="page-header py-3 border-b border-border bg-bg-elevated shrink-0">
      <div className="page-header__row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-[15px] font-semibold tracking-[0.04em]">{title}</h1>
            {badge && (
              <span className="px-1.5 h-[18px] inline-flex items-center bg-accent/10 border border-accent/30 text-accent font-mono text-[10px] uppercase tracking-[0.12em] shrink-0">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[11px] text-fg-muted mt-0.5 break-words">{subtitle}</div>
          )}
        </div>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
    </div>
  );
}

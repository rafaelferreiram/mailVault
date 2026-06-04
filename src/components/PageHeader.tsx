import { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: ReactNode;
  badge?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, badge, actions }: Props) {
  return (
    <div className="px-6 py-3 border-b border-border bg-bg-elevated">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-[15px] font-semibold tracking-[0.04em]">{title}</h1>
              {badge && (
                <span className="px-1.5 h-[18px] inline-flex items-center bg-accent/10 border border-accent/30 text-accent font-mono text-[10px] uppercase tracking-[0.12em]">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-[11px] text-fg-muted mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

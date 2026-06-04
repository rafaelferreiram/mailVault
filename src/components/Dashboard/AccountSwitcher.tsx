import clsx from 'clsx';
import type { AccountProfile } from '@shared/types';

type Props = {
  accounts: AccountProfile[];
  scope: string | 'all';
  liveStatus: Map<string, 'active' | 'paused' | 'error'>;
  onChange: (scope: string | 'all') => void;
};

export function AccountSwitcher({ accounts, scope, liveStatus, onChange }: Props) {
  if (accounts.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 px-3 pt-3 pb-0 flex-wrap">
      <Tab
        active={scope === 'all'}
        label="All accounts"
        onClick={() => onChange('all')}
      />
      {accounts.map((a) => {
        const st = liveStatus.get(a.id) ?? 'paused';
        const dot =
          st === 'active' ? 'bg-ok' : st === 'error' ? 'bg-danger' : a.needsReauth ? 'bg-danger' : 'bg-warn';
        return (
          <Tab
            key={a.id}
            active={scope === a.id}
            label={a.email}
            dot={dot}
            onClick={() => onChange(a.id)}
          />
        );
      })}
    </div>
  );
}

function Tab({
  active,
  label,
  dot,
  onClick,
}: {
  active: boolean;
  label: string;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-3 h-7 text-[11px] font-mono border transition-colors',
        active
          ? 'bg-accent/10 border-accent/40 text-accent'
          : 'border-border-subtle text-fg-muted hover:text-fg hover:bg-bg-hover'
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dot)} />}
      <span className="truncate max-w-[180px]">{label}</span>
    </button>
  );
}
